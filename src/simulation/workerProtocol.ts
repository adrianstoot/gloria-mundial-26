import type { MatchCommand, MatchSetup, MatchSnapshot, SimulationResult } from '../domain'

export type MatchWorkerRequest =
  | { requestId: string; type: 'simulate'; setup: MatchSetup }
  | { requestId: string; type: 'create'; setup: MatchSetup }
  | { requestId: string; type: 'step'; ticks?: number }
  | { requestId: string; type: 'command'; command: MatchCommand }
  | { requestId: string; type: 'finish' }

export type MatchWorkerResponse =
  | { requestId: string; ok: true; type: 'snapshot'; snapshot: MatchSnapshot; finished: boolean }
  | { requestId: string; ok: true; type: 'result'; result: SimulationResult }
  | { requestId: string; ok: true; type: 'command'; accepted: boolean }
  | { requestId: string; ok: false; error: string }

