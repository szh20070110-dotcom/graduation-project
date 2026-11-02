/**
 * 使用无头浏览器截图，供 docs/04-测试报告.md 引用。
 *
 * 前置条件：
 *   1. npm run build
 *   2. npm run preview -- --port 4173
 * 运行：
 *   node scripts/capture-screenshots.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'http://localhost:4173'
const OUT_DIR = path.resolve('docs/screenshots')
const PROFILE_DIR = path.resolve('.chrome-profile')
const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(check, label, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const value = await check()
      if (value) return value
    } catch {
      // 服务尚未就绪，继续轮询
    }
    await sleep(200)
  }
  throw new Error(`等待超时：${label}`)
}

function createClient(wsUrl) {
  const socket = new WebSocket(wsUrl)
  let nextId = 0
  const pending = new Map()

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    }
  })

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve)
    socket.addEventListener('error', reject)
  })

  return {
    ready,
    send(method, params = {}) {
      const id = (nextId += 1)
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params }))
      })
    },
    close() {
      socket.close()
    }
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  await rm(PROFILE_DIR, { recursive: true, force: true })

  const browserPath = process.env.BROWSER_PATH || EDGE_CANDIDATES.find((candidate) => existsSync(candidate))
  if (!browserPath) {
    throw new Error('未找到 Edge/Chrome，请通过环境变量 BROWSER_PATH 指定可执行文件路径')
  }
  const browser = spawn(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--remote-debugging-port=9222',
      `--user-data-dir=${PROFILE_DIR}`,
      '--window-size=1440,1000',
      `${BASE}/#/login`
    ],
    { stdio: 'ignore' }
  )

  try {
    const target = await waitFor(async () => {
      const list = await fetch('http://127.0.0.1:9222/json/list').then((res) => res.json())
      return list.find((item) => item.type === 'page' && item.url.includes('localhost:4173'))
    }, '浏览器调试端口')

    const client = createClient(target.webSocketDebuggerUrl)
    await client.ready
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    })

    async function capture(name, route, userId) {
      const sessionScript = userId
        ? `localStorage.setItem('srms:session:v1', ${JSON.stringify(userId)});localStorage.removeItem('srms:v1');`
        : `localStorage.clear();`
      await client.send('Runtime.evaluate', { expression: sessionScript })
      // 追加唯一查询参数，强制整页重新加载，使 store 重新读取 localStorage
      await client.send('Page.navigate', { url: `${BASE}/?shot=${name}#${route}` })
      await sleep(2000)
      // 若路由守卫跳转，等待最终页面稳定
      await sleep(400)
      const { result } = await client.send('Runtime.evaluate', {
        expression: 'document.querySelector("main")?.innerText.slice(0, 80) || ""',
        returnByValue: true
      })
      console.log(`check ${name}: ${JSON.stringify(result.value)}`)
      const { cssContentSize } = await client.send('Page.getLayoutMetrics')
      const shot = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width: Math.ceil(cssContentSize.width),
          height: Math.ceil(Math.min(cssContentSize.height, 2600)),
          scale: 1
        }
      })
      const file = path.join(OUT_DIR, `${name}.png`)
      await writeFile(file, Buffer.from(shot.data, 'base64'))
      console.log(`saved ${file}`)
    }

    await capture('01-login', '/login', null)
    await capture('02-student-home', '/student', 'user-2021001')
    await capture('03-my-reservations', '/student/reservations', 'user-2021001')
    await capture('04-admin-dashboard', '/admin', 'user-admin')
    await capture('05-admin-reservations', '/admin/reservations', 'user-admin')

    client.close()
  } finally {
    browser.kill()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})