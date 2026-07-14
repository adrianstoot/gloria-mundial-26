/// <reference lib="webworker" />
import { createMatch, simulateMatch, type MatchEngine } from './matchEngine'
import type { MatchWorkerRequest, MatchWorkerResponse } from './workerProtocol'

const scope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope
let engine: MatchEngine | undefined

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

scope.onmessage = (message: MessageEvent<MatchWorkerRequest>) => {
  const request = message.data
  try {
    let response: MatchWorkerResponse
    if (request.type === 'simulate') {
      response = { requestId: request.requestId, ok: true, type: 'result', result: simulateMatch(request.setup) }
    } else if (request.type === 'create') {
      engine = createMatch(request.setup)
      response = { requestId: request.requestId, ok: true, type: 'snapshot', snapshot: engine.currentSnapshot, finished: false }
    } else if (request.type === 'step') {
      if (!engine) throw new Error('No hay ningún partido activo en el worker.')
      let snapshot = engine.currentSnapshot
      const ticks = Math.max(1, Math.min(600, Math.trunc(request.ticks ?? 1)))
      for (let tick = 0; tick < ticks && !engine.isFinished; tick += 1) snapshot = engine.step()
      response = { requestId: request.requestId, ok: true, type: 'snapshot', snapshot, finished: engine.isFinished }
    } else if (request.type === 'command') {
      if (!engine) throw new Error('No hay ningún partido activo en el worker.')
      response = { requestId: request.requestId, ok: true, type: 'command', accepted: engine.applyCommand(request.command) }
    } else {
      if (!engine) throw new Error('No hay ningún partido activo en el worker.')
      response = { requestId: request.requestId, ok: true, type: 'result', result: engine.runToEnd() }
    }
    scope.postMessage(response)
  } catch (error) {
    scope.postMessage({ requestId: request.requestId, ok: false, error: errorMessage(error) } satisfies MatchWorkerResponse)
  }
}

