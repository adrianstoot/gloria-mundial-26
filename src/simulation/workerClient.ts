import type { MatchCommand, MatchSetup, MatchSnapshot, SimulationResult } from '../domain'
import { simulateMatch } from './matchEngine'
import type { MatchWorkerRequest, MatchWorkerResponse } from './workerProtocol'

type SuccessfulResponse = Extract<MatchWorkerResponse, { ok: true }>
type RequestWithoutId = MatchWorkerRequest extends infer Request
  ? Request extends { requestId: string } ? Omit<Request, 'requestId'> : never
  : never

export class MatchWorkerClient {
  private readonly worker: Worker
  private sequence = 0
  private readonly pending = new Map<string, { resolve: (value: SuccessfulResponse) => void; reject: (reason: Error) => void }>()

  constructor(worker = new Worker(new URL('./match.worker.ts', import.meta.url), { type: 'module', name: 'gm26-match-engine' })) {
    this.worker = worker
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', this.handleError)
  }

  async simulate(setup: MatchSetup): Promise<SimulationResult> {
    const response = await this.send({ type: 'simulate', setup })
    if (response.type !== 'result') throw new Error('Respuesta inesperada del motor de partido.')
    return response.result
  }

  async create(setup: MatchSetup): Promise<MatchSnapshot> {
    const response = await this.send({ type: 'create', setup })
    if (response.type !== 'snapshot') throw new Error('Respuesta inesperada del motor de partido.')
    return response.snapshot
  }

  async step(ticks = 1): Promise<{ snapshot: MatchSnapshot; finished: boolean }> {
    const response = await this.send({ type: 'step', ticks })
    if (response.type !== 'snapshot') throw new Error('Respuesta inesperada del motor de partido.')
    return { snapshot: response.snapshot, finished: response.finished }
  }

  async command(command: MatchCommand): Promise<boolean> {
    const response = await this.send({ type: 'command', command })
    if (response.type !== 'command') throw new Error('Respuesta inesperada del motor de partido.')
    return response.accepted
  }

  async finish(): Promise<SimulationResult> {
    const response = await this.send({ type: 'finish' })
    if (response.type !== 'result') throw new Error('Respuesta inesperada del motor de partido.')
    return response.result
  }

  dispose(): void {
    this.worker.removeEventListener('message', this.handleMessage)
    this.worker.removeEventListener('error', this.handleError)
    this.worker.terminate()
    for (const request of this.pending.values()) request.reject(new Error('El worker de partido fue cerrado.'))
    this.pending.clear()
  }

  private send(request: RequestWithoutId): Promise<SuccessfulResponse> {
    const requestId = `match-worker-${++this.sequence}`
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.worker.postMessage({ ...request, requestId } as MatchWorkerRequest)
    })
  }

  private readonly handleMessage = (message: MessageEvent<MatchWorkerResponse>): void => {
    const response = message.data
    const request = this.pending.get(response.requestId)
    if (!request) return
    this.pending.delete(response.requestId)
    if (!response.ok) request.reject(new Error(response.error))
    else request.resolve(response)
  }

  private readonly handleError = (event: ErrorEvent): void => {
    const error = new Error(event.message || 'El worker de partido ha fallado.')
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
  }
}

/** Uses a Web Worker when available and keeps a deterministic synchronous fallback. */
export async function simulateMatchAsync(setup: MatchSetup): Promise<SimulationResult> {
  if (typeof Worker === 'undefined') return Promise.resolve().then(() => simulateMatch(setup))
  const client = new MatchWorkerClient()
  try {
    return await client.simulate(setup)
  } finally {
    client.dispose()
  }
}
