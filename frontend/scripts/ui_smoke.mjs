/**
 * Headless UI smoke test.
 *
 * Drives the running dev server with Chrome via the DevTools Protocol and
 * checks that the key screens render for both roles. No test framework.
 *
 *   node scripts/ui_smoke.mjs [baseUrl]
 *
 * Requires the Vite dev server and the PHP backend to be running.
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const PORT = 9333
const CHROME =
  process.env.CHROME ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let passed = 0
let failed = 0
function check(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  PASS  ${label}`)
  } else {
    failed++
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

const userDataDir = mkdtempSync(join(tmpdir(), 'clinic-smoke-'))
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

async function waitForChrome() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return
    } catch {
      /* not ready */
    }
    await sleep(250)
  }
  throw new Error('Chrome did not start')
}

let ws
let messageId = 0
const pendingCalls = new Map()

function send(method, params = {}) {
  const id = ++messageId
  return new Promise((resolve, reject) => {
    pendingCalls.set(id, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  }
  return result.result.value
}

async function waitForText(text, timeout = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const body = await evaluate('document.body ? document.body.innerText : ""')
    if (body && body.includes(text)) return body
    await sleep(300)
  }
  return await evaluate('document.body ? document.body.innerText : ""')
}

async function signInAs(username, password) {
  const token = await evaluate(`(async () => {
    const res = await fetch('${BASE}/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '${username}', password: '${password}' })
    });
    const json = await res.json();
    localStorage.setItem('clinic.token', json.data.token);
    return json.data.token;
  })()`)
  return token
}

async function goto(path, expectText) {
  await send('Page.navigate', { url: `${BASE}${path}` })
  return waitForText(expectText)
}

try {
  await waitForChrome()
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
  const page = targets.find((t) => t.type === 'page')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pendingCalls.has(msg.id)) {
      pendingCalls.get(msg.id)(msg)
      pendingCalls.delete(msg.id)
    }
  }
  await send('Page.enable')
  await send('Runtime.enable')

  console.log('\n== Login screen ==')
  let body = await goto('/login', 'Sign in')
  check('login screen renders', body.includes('Sign in') && body.includes('Clinic Manager'))

  console.log('\n== Doctor screens ==')
  await signInAs('doctor', 'Doctor@123')
  body = await goto('/doctor/dashboard', "Today's patients")
  check('doctor dashboard renders', body.includes("Today's patients"))
  check('doctor dashboard shows totals', body.includes('Total charges') && body.includes('Collected'))

  body = await goto('/doctor/new-visit', 'Consultation fee')
  check('new visit screen renders', body.includes('Consultation fee') && body.includes('Create Visit'))

  body = await goto('/doctor/visits', 'Visits')
  check('visits screen renders', body.includes('Visits'))

  body = await goto('/doctor/reports', 'Daily report')
  check('reports screen renders', body.includes('Daily closing') || body.includes('Charges vs collections'))

  // Print stylesheet: navigation must disappear when printing
  await send('Emulation.setEmulatedMedia', { media: 'print' })
  const printState = await evaluate(`(() => {
    const aside = document.querySelector('aside');
    const header = document.querySelector('header');
    const mobileNav = document.querySelector('[aria-label="Primary navigation"]');
    return {
      aside: aside ? getComputedStyle(aside).display : 'missing',
      header: header ? getComputedStyle(header).display : 'missing',
      mobileNav: mobileNav ? getComputedStyle(mobileNav).display : 'missing',
    };
  })()`)
  check(
    'print hides navigation chrome',
    printState.aside === 'none' && printState.header === 'none' && printState.mobileNav === 'none',
    JSON.stringify(printState),
  )
  await send('Emulation.setEmulatedMedia', { media: '' })

  body = await goto('/doctor/audit', 'Audit log')
  check('audit log renders', body.includes('Audit log'))

  body = await goto('/doctor/settings', 'Clinic settings')
  check('settings renders', body.includes('Clinic settings'))

  body = await goto('/doctor/users', 'Staff accounts')
  check('staff screen renders', body.includes('Staff accounts'))

  body = await goto('/profile', 'Change password')
  check('profile screen renders', body.includes('Change password'))

  // Route guard: a doctor must not reach the cashier area
  body = await goto('/cashier/pending', 'Dashboard')
  check('doctor redirected away from cashier route', !body.includes('Pending payments') || body.includes("Today's patients") || body.includes('Good '))

  console.log('\n== Cashier screens ==')
  await signInAs('cashier', 'Cashier@123')
  body = await goto('/cashier/dashboard', 'Pending payments')
  check('cashier dashboard renders', body.includes('Pending payments'))
  check('cashier dashboard shows collected + pending', body.includes('Collected today') && body.includes('Pending'))

  body = await goto('/cashier/pending', 'Pending payments')
  check('pending payments screen renders', body.includes('Pending payments'))

  body = await goto('/cashier/payments', 'Payments')
  check('payments screen renders', body.includes('Payments'))

  // Cashier must not reach a doctor route
  body = await goto('/doctor/reports', 'Dashboard')
  check('cashier redirected away from doctor route', !body.includes('Daily closing'))

  console.log(`\n----------------------------------------`)
  console.log(`PASSED: ${passed}   FAILED: ${failed}`)
} catch (err) {
  console.error('Smoke test error:', err.message)
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
