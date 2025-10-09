import { Chess, type Move } from 'chess.js'

type ComputeRequest = {
  id: number
  type: 'compute'
  payload: { fen: string; depth: number; aiColor: 'w' | 'b' }
}

type ResponseMessage = {
  id: number
  move: Move | null
}

type WorkerRequest = ComputeRequest

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

const CHECKMATE_SCORE = 10_000

function evaluateBoard(game: Chess, aiColor: 'w' | 'b') {
  let score = 0

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) {
        continue
      }
      const baseValue = PIECE_VALUES[piece.type] ?? 0
      score += piece.color === 'w' ? baseValue : -baseValue
    }
  }

  const mobility = game.moves().length * 10
  score += game.turn() === 'w' ? mobility : -mobility

  return aiColor === 'w' ? score : -score
}

function minimax(game: Chess, depth: number, alpha: number, beta: number, aiColor: 'w' | 'b') {
  if (depth === 0 || game.isGameOver()) {
    if (game.isCheckmate()) {
      return {
        score: game.turn() === aiColor ? -CHECKMATE_SCORE : CHECKMATE_SCORE,
        move: null as Move | null,
      }
    }
    if (game.isDraw()) {
      return { score: 0, move: null as Move | null }
    }
    return { score: evaluateBoard(game, aiColor), move: null as Move | null }
  }

  const maximizing = game.turn() === aiColor
  const moves = game.moves({ verbose: true }) as Move[]

  if (moves.length === 0) {
    if (game.isCheckmate()) {
      return {
        score: maximizing ? -CHECKMATE_SCORE : CHECKMATE_SCORE,
        move: null as Move | null,
      }
    }
    return { score: 0, move: null as Move | null }
  }

  let bestMove: Move | null = null

  if (maximizing) {
    let bestScore = -Infinity

    for (const move of moves) {
      game.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' })
      const result = minimax(game, depth - 1, alpha, beta, aiColor)
      game.undo()

      if (result.score > bestScore) {
        bestScore = result.score
        bestMove = move
      }

      alpha = Math.max(alpha, bestScore)
      if (beta <= alpha) {
        break
      }
    }

    return { score: bestScore, move: bestMove }
  }

  let bestScore = Infinity

  for (const move of moves) {
    game.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' })
    const result = minimax(game, depth - 1, alpha, beta, aiColor)
    game.undo()

    if (result.score < bestScore) {
      bestScore = result.score
      bestMove = move
    }

    beta = Math.min(beta, bestScore)
    if (beta <= alpha) {
      break
    }
  }

  return { score: bestScore, move: bestMove }
}

function handleCompute({ id, payload }: ComputeRequest) {
  const { fen, depth, aiColor } = payload
  const simulation = new Chess(fen)
  const { move } = minimax(simulation, depth, -Infinity, Infinity, aiColor)
  postMessage({ id, move } satisfies ResponseMessage)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (!message) {
    return
  }

  if (message.type === 'compute') {
    handleCompute(message)
  }
}
