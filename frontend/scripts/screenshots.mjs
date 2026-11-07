/**
 * Capture screenshots of key screens for design review.
 *   node scripts/screenshots.mjs [outDir]
 * Requires dev server + backend running.
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'http://127.0.0.1:5173'
const OUT = process.argv[2] || join(tmpdir(), 'clinic-shots')
const PORT = 9335
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync(OUT, { recursive: true })
const userDataDir = mkdtempSync(join(tmpdir(), 'clinic-shots-'))
const chrome = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-allow-origins=*', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`, 'about:blank'],
  { stdio: 'ignore' },
)

let ws
let id = 0
const pending = new Map()
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)))
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  return r.result.value
}

async function shot(name, { width = 1440, height = 900, mobile = false } = {}) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  })
  await sleep(700)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
  console.log('captured', name)
}

async function login(username, password) {
  await evaluate(`(async () => {
    const r = await fetch('${BASE}/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'${username}', password:'${password}' }) });
    const j = await r.json();
    localStorage.setItem('clinic.token', j.data.token);
  })()`)
}

try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break
    } catch {}
    await sleep(250)
  }
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  }
  await send('Page.enable')
  await send('Runtime.enable')

  await send('Page.navigate', { url: `${BASE}/login` })
  await sleep(1800)
  await shot('01-login', { width: 1440, height: 900 })

  await login('doctor', 'Doctor@123')
  await send('Page.navigate', { url: `${BASE}/doctor/dashboard` })
  await sleep(2200)
  await shot('02-doctor-dashboard', { width: 1440, height: 1000 })
  await shot('03-doctor-dashboard-mobile', { width: 390, height: 844, mobile: true })

  await send('Page.navigate', { url: `${BASE}/doctor/new-visit` })
  await sleep(1800)
  await shot('04-new-visit-mobile', { width: 390, height: 844, mobile: true })

  await send('Page.navigate', { url: `${BASE}/doctor/reports` })
  await sleep(2000)
  await shot('05-reports', { width: 1440, height: 1000 })

  await login('cashier', 'Cashier@123')
  await send('Page.navigate', { url: `${BASE}/cashier/dashboard` })
  await sleep(2200)
  await shot('06-cashier-dashboard', { width: 1440, height: 1000 })

  await send('Page.navigate', { url: `${BASE}/cashier/payments` })
  await sleep(2000)
  await shot('07-cashier-payments', { width: 1440, height: 900 })

  const dToken = (
    await (
      await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'doctor', password: 'Doctor@123' }),
      })
    ).json()
  ).data.token
  const pays = (
    await (await fetch(`${BASE}/api/payments?per_page=1`, { headers: { Authorization: `Bearer ${dToken}` } })).json()
  ).data
  if (pays.items[0]) {
    await login('cashier', 'Cashier@123')
    await send('Page.navigate', { url: `${BASE}/receipt/${pays.items[0].id}` })
    await sleep(1800)
    await shot('08-receipt-thermal', { width: 520, height: 800 })
    await shot('09-receipt-a4', { width: 900, height: 1000 })
  }
} catch (err) {
  console.error('error', err.message)
} finally {
  try { ws?.close() } catch {}
  chrome.kill()
  await sleep(400)
  try { rmSync(userDataDir, { recursive: true, force: true }) } catch {}
  console.log('output:', OUT)
}
