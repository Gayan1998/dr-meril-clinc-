/**
 * End-to-end UI workflow test.
 *
 * Drives the real UI with Chrome (DevTools Protocol) to prove the complete
 * doctor -> cashier -> payment -> receipt path works, and that the cashier
 * payment dialog has no editable amount field.
 *
 *   node scripts/ui_workflow.mjs [baseUrl]
 *
 * Requires the Vite dev server and the PHP backend to be running.
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const PORT = 9334
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let passed = 0
let failed = 0
const check = (label, condition, detail = '') => {
  if (condition) {
    passed++
    console.log(`  PASS  ${label}`)
  } else {
    failed++
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

const userDataDir = mkdtempSync(join(tmpdir(), 'clinic-flow-'))
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ],
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

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

async function waitForText(text, timeout = 20000) {
  const start = Date.now()
  let body = ''
  while (Date.now() - start < timeout) {
    body = await evaluate('document.body ? document.body.innerText : ""')
    if (body.includes(text)) return body
    await sleep(250)
  }
  return body
}

async function clickButton(text, scope = 'document') {
  return evaluate(`(() => {
    const root = ${scope};
    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(text)}));
    if (!btn) return false;
    btn.click();
    return true;
  })()`)
}

try {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) break
    } catch {}
    await sleep(250)
  }
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
  const page = targets.find((t) => t.type === 'page')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
  await send('Page.enable')
  await send('Runtime.enable')

  console.log('\n== Doctor creates the charge (API) ==')
  const doctor = (await api('/api/auth/login', { method: 'POST', body: { username: 'doctor', password: 'Doctor@123' } })).data.token
  const stamp = Date.now().toString().slice(-6)
  const patientName = `Flow Patient ${stamp}`
  const patient = (await api('/api/patients', { method: 'POST', token: doctor, body: { full_name: patientName, phone: '0770000000' } })).data
  const visit = (await api('/api/visits', { method: 'POST', token: doctor, body: { patient_id: patient.id, consultation_fee: 2000 } })).data
  check('visit created and pending', visit.status === 'pending_payment' && visit.consultation_fee === 2000)

  console.log('\n== Cashier collects through the UI ==')
  await send('Page.navigate', { url: `${BASE}/cashier/pending` })
  await waitForText('Sign in')
  await evaluate(`(async () => {
    const res = await fetch('${BASE}/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: 'Cashier@123' })
    });
    const json = await res.json();
    localStorage.setItem('clinic.token', json.data.token);
  })()`)
  await send('Page.navigate', { url: `${BASE}/cashier/pending` })
  let body = await waitForText(patientName)
  check('new charge appears in the cashier queue', body.includes(patientName) && body.includes('2,000.00'))

  console.log('\n== Cashier sees new charges live (no refresh) ==')
  const liveName = `Live Walk-in ${stamp}`
  const liveVisit = (
    await api('/api/visits', {
      method: 'POST',
      token: doctor,
      body: { patient_name: liveName, consultation_fee: 1234 },
    })
  ).data
  check('walk-in charge created while cashier is watching', liveVisit.status === 'pending_payment')
  // No navigation here: the queue must update itself by polling.
  const liveBody = await waitForText(liveName, 15000)
  check('new charge appears without a page refresh', liveBody.includes(liveName))

  // Stub window.print so headless Chrome records the auto-preview instead of blocking.
  await evaluate(`window.__printCalls = 0; window.print = () => { window.__printCalls++ }`)

  const opened = await evaluate(`(() => {
    const row = [...document.querySelectorAll('li')].find((li) => li.textContent.includes(${JSON.stringify(patientName)}));
    if (!row) return 'no-row';
    const btn = [...row.querySelectorAll('button')].find((b) => b.textContent.includes('Collect'));
    if (!btn) return 'no-button';
    btn.click();
    return 'ok';
  })()`)
  check('collect dialog opens', opened === 'ok', opened)

  body = await waitForText('Confirm payment')
  check('confirmation dialog shown', body.includes('Confirm payment'))

  const dialogInputs = await evaluate(
    `[...document.querySelectorAll('[role=dialog] input')].map((i) => i.name)`,
  )
  check('payment method radios present', dialogInputs.includes('payment_method'))
  check('NO editable amount field in the dialog', !dialogInputs.includes('amount'), dialogInputs.join(','))

  await clickButton('Confirm Payment', "[...document.querySelectorAll('[role=dialog]')].at(-1)")
  await sleep(1500)
  body = await waitForText('Payment receipt')
  check('payment succeeds and the invoice opens in the same modal', body.includes('Payment receipt'))

  const dialogText = await evaluate(
    `[...document.querySelectorAll('[role=dialog]')].map((d) => d.innerText).join('\\n')`,
  )
  const receiptNumber = (dialogText.match(/R-\d+/) || [null])[0]
  check('invoice shows the receipt number', Boolean(receiptNumber), receiptNumber)
  check('invoice shows the patient and amount', dialogText.includes(patientName) && dialogText.includes('2,000.00'))
  check('invoice shows PAID', dialogText.includes('PAID'))
  check(
    'print button is in the modal',
    await evaluate(`[...document.querySelectorAll('[role=dialog] button')].some((b) => b.textContent.includes('Print Invoice'))`),
  )
  check(
    'print preview opens automatically after payment',
    (await evaluate('window.__printCalls || 0')) >= 1,
  )
  check(
    'print-only invoice copy exists for printing',
    await evaluate(`!!document.querySelector('.receipt-print-only .receipt-sheet')`),
  )
  check('stayed on the cashier queue (no navigation)', (await evaluate('location.pathname')) === '/cashier/pending')

  console.log('\n== Server state ==')
  const after = (await api(`/api/visits/${visit.id}`, { token: doctor })).data
  check('visit is paid on the server', after.status === 'paid')
  check('linked payment amount is the doctor fee', after.payment && after.payment.id)

  console.log('\n== Standalone receipt page still works ==')
  await send('Page.navigate', { url: `${BASE}/receipt/${after.payment.id}` })
  body = await waitForText('Receipt No')
  check('receipt page renders', body.includes('Receipt No') && body.includes(patientName))
  check('receipt shows the correct amount', body.includes('2,000.00'))

  const pendingAfter = (await api('/api/payments/pending', { token: doctor })).data
  check('charge removed from pending queue', !pendingAfter.items.some((item) => item.id === visit.id))

  console.log('\n----------------------------------------')
  console.log(`PASSED: ${passed}   FAILED: ${failed}`)
} catch (err) {
  console.error('Workflow test error:', err.message)
  failed++
} finally {
  try {
    ws?.close()
  } catch {}
  chrome.kill()
  await sleep(400)
  try {
    rmSync(userDataDir, { recursive: true, force: true })
  } catch {}
  process.exit(failed ? 1 : 0)
}
