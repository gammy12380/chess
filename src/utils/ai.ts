import type { Move } from 'chess.js'

type ComputeMessage = {
  id: number
  type: 'compute'
  payload: { fen: string; depth: number; aiColor: 'w' | 'b' }
}

type ResponseMessage = {
  id: number
  move: Move | null
}

type PendingRequest = {
  resolve: (move: Move | null) => void
  reject: (error: Error) => void
}

let aiWorker: Worker | null = null
let nextRequestId = 1
const pendingRequests = new Map<number, PendingRequest>()

function handleWorkerMessage(event: MessageEvent<ResponseMessage>) {
  const { id, move } = event.data
  const entry = pendingRequests.get(id)
  if (!entry) {
    return
  }
  pendingRequests.delete(id)
  entry.resolve(move)
}

function handleWorkerError(error: ErrorEvent | MessageEvent) {
  const workerError =
    error instanceof ErrorEvent
      ? (error.error ?? new Error(error.message))
      : new Error('AI worker message error')
  pendingRequests.forEach(({ reject }) => {
    reject(workerError)
  })
  pendingRequests.clear()
  terminateAiWorker()
}

function ensureWorker() {
  if (aiWorker) {
    return aiWorker
  }

  aiWorker = new Worker(new URL('../workers/aiWorker.ts', import.meta.url), { type: 'module' })
  aiWorker.addEventListener('message', handleWorkerMessage as EventListener)
  aiWorker.addEventListener('error', handleWorkerError as EventListener)
  aiWorker.addEventListener('messageerror', handleWorkerError as EventListener)
  return aiWorker
}

export function terminateAiWorker() {
  if (!aiWorker) {
    return
  }
  aiWorker.terminate()
  aiWorker = null
  pendingRequests.forEach(({ reject }) => {
    reject(new Error('AI worker terminated'))
  })
  pendingRequests.clear()
  nextRequestId = 1
}

export function computeBestMove(options: {
  fen: string
  depth: number
  aiColor: 'w' | 'b'
}): Promise<Move | null> {
  const worker = ensureWorker()
  const requestId = nextRequestId
  nextRequestId += 1

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject })
    const message: ComputeMessage = {
      id: requestId,
      type: 'compute',
      payload: options,
    }
    try {
      worker.postMessage(message)
    } catch (error) {
      pendingRequests.delete(requestId)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}
