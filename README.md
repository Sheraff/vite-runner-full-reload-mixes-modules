# Vite module runner: an import in flight during a `full-reload` finishes on a mix of old and new modules

Plain Vite (no framework), SSR module runner (`server.environments.ssr.runner`).

```sh
npm install && npm run repro
```

No browser needed. Exits 1 when the bug shows, 0 otherwise. `node repro.mjs --no-reload` is the control (no edit, prints `OK`).

What it does:

1. `runner.import('/src/app.js')` (request 1). `app.js` imports `other.js`, `registry.js` (a module-level singleton), `slow.js` (awaits a gate at top level), then `b.js`, which imports `registry.js` too.
2. While request 1 waits in `slow.js`, edit `src/other.js`: Vite sends the SSR environment a `full-reload`.
3. `runner.import('/src/app.js')` again (request 2), then open the gate.

Output on vite 8.3.7:

```
vite 8.3.7, full-reloads sent: 1
request 1 (in flight during the reload): app.js sees registry #1, b.js sees registry #2  <-- two instances of src/registry.js
request 2 (after the reload): app.js sees registry #2, b.js sees registry #2
FAIL: request 1 finished on a mix of old and new module instances
```

Issue: https://github.com/vitejs/vite/issues/24046
