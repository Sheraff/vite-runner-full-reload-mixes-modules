// evaluates slowly: waits for the repro script to open the gate
globalThis.slowEvaluations++
await globalThis.gate
