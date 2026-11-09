import fs from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { createServer } from 'vite'

let openGate
globalThis.gate = new Promise((resolve) => (openGate = resolve))
globalThis.slowEvaluations = 0
globalThis.registryCount = 0

const until = async (done, ms) => {
  for (const end = Date.now() + ms; !done() && Date.now() < end; ) await sleep(10)
  return done()
}

const otherFile = new URL('./src/other.js', import.meta.url)
const otherSource = fs.readFileSync(otherFile, 'utf8')
const server = await createServer({
  root: import.meta.dirname,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, ws: false },
})
const runner = server.environments.ssr.runner
let fullReloads = 0
const send = server.environments.ssr.hot.send.bind(server.environments.ssr.hot)
server.environments.ssr.hot.send = (payload, ...rest) => {
  if (payload?.type === 'full-reload') fullReloads++
  return send(payload, ...rest)
}

try {
  // request 1: stops in the middle of src/app.js's imports (src/slow.js)
  const first = runner.import('/src/app.js')
  await until(() => globalThis.slowEvaluations === 1, 5000)

  if (!process.argv.includes('--no-reload')) {
    // an edit Vite answers with an SSR full-reload
    fs.writeFileSync(otherFile, 'export const other = 2\n')
    await until(() => fullReloads > 0, 5000)
    // the reload's own re-import reaches src/slow.js (bounded: a runner may also wait)
    await until(() => globalThis.slowEvaluations === 2, 2000)
  }

  // request 2, after the reload
  const second = runner.import('/src/app.js')
  openGate()

  const [a1, a2] = await Promise.all([first, second])
  const report = (name, { app }) =>
    console.log(
      `${name}: app.js sees registry #${app.registry.id}, b.js sees registry #${app.bRegistry.id}` +
        (app.registry === app.bRegistry ? '' : '  <-- two instances of src/registry.js'),
    )
  console.log(`vite ${(await import('vite/package.json', { with: { type: 'json' } })).default.version}, full-reloads sent: ${fullReloads}`)
  report('request 1 (in flight during the reload)', a1)
  report('request 2 (after the reload)', a2)
  const ok = a1.app.registry === a1.app.bRegistry && a2.app.registry === a2.app.bRegistry
  console.log(ok ? 'OK' : 'FAIL: request 1 finished on a mix of old and new module instances')
  process.exitCode = ok ? 0 : 1
} finally {
  openGate()
  fs.writeFileSync(otherFile, otherSource)
  await server.close()
}
