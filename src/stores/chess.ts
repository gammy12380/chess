import { Chess, type Move, type Piece, type Square } from 'chess.js'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { computeBestMove } from '@/utils/ai'
import type { PromotionPiece } from '@/constants/pieces'

function cloneBoard(source: (Piece | null)[][]) {
  return source.map((row) => row.slice())
}

function labelForColor(color: 'w' | 'b') {
  return color === 'w' ? '白方' : '黑方'
}

type GameMode = 'pvp' | 'pvai'
type AiDifficulty = 'easy' | 'medium' | 'hard'

const AI_DEPTH_MAP: Record<AiDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

export const useChessStore = defineStore('chess', () => {
  const game = new Chess()

  const board = ref<(Piece | null)[][]>(cloneBoard(game.board()))
  const selectedSquare = ref<Square | null>(null)
  const legalMoves = ref<Move[]>([])
  const lastMove = ref<{ from: Square; to: Square; san: string } | null>(null)
  const history = ref<string[]>([])

  const turnColor = ref<'w' | 'b'>(game.turn())
  const isGameOver = ref(game.isGameOver())
  const isCheck = ref(game.isCheck())
  const statusMessage = ref('')
  const showResultModal = ref(false)
  const finalResultMessage = ref('')
  const isSetupComplete = ref(false)
  const pendingPromotion = ref<{
    from: Square
    to: Square
    color: 'w' | 'b'
    moves: Move[]
  } | null>(null)

  const mode = ref<GameMode>('pvp')
  const aiDifficulty = ref<AiDifficulty>('medium')
  const aiColor = ref<'w' | 'b'>('b')
  const isAiThinking = ref(false)

  let aiTaskId = 0

  const turnLabel = computed(() => labelForColor(turnColor.value))
  const opponentLabel = computed(() => labelForColor(turnColor.value === 'w' ? 'b' : 'w'))
  const isAiEnabled = computed(() => mode.value === 'pvai')

  const legalTargets = computed(() => new Set(legalMoves.value.map((move) => move.to)))
  const captureTargets = computed(
    () =>
      new Set(
        legalMoves.value
          .filter((move) => move.flags.includes('c') || move.flags.includes('e'))
          .map((move) => move.to),
      ),
  )

  function deriveStatusMessage(currentTurn: 'w' | 'b', check: boolean) {
    const currentLabel = labelForColor(currentTurn)
    const opponent = labelForColor(currentTurn === 'w' ? 'b' : 'w')

    if (game.isCheckmate()) {
      return `${opponent} 獲勝（將死 ${currentLabel}）`
    }
    if (game.isStalemate()) {
      return '僵局（無合法著法，和局）'
    }
    if (game.isThreefoldRepetition()) {
      return '三次重複局面，和棋'
    }
    if (game.isInsufficientMaterial()) {
      return '子力不足，和棋'
    }
    if (game.isDraw()) {
      return '五十步規則或其他條件導致和棋'
    }
    if (check) {
      return `${currentLabel} 正在被將軍`
    }
    return ''
  }

  function refreshDerivedState() {
    const currentTurn = game.turn()
    turnColor.value = currentTurn
    const check = game.isCheck()
    isCheck.value = check
    isGameOver.value = game.isGameOver()
    statusMessage.value = deriveStatusMessage(currentTurn, check)

    if (isGameOver.value) {
      finalResultMessage.value =
        statusMessage.value || `${labelForColor(currentTurn === 'w' ? 'b' : 'w')} 獲勝`
      showResultModal.value = true
    }
  }

  function updateBoard() {
    board.value = cloneBoard(game.board())
    history.value = game.history()
    refreshDerivedState()
  }

  function clearSelection() {
    selectedSquare.value = null
    legalMoves.value = []
  }

  function selectSquare(square: Square) {
    if (!isSetupComplete.value || pendingPromotion.value) {
      return
    }

    if (isAiEnabled.value && isAiThinking.value) {
      return
    }

    if (selectedSquare.value && legalTargets.value.has(square)) {
      executeMove(square)
      return
    }

    const piece = game.get(square)
    const currentTurn = game.turn()

    if (piece && piece.color === currentTurn) {
      selectedSquare.value = square
      legalMoves.value = game.moves({ square, verbose: true })
      return
    }

    clearSelection()
  }

  function executeMove(target: Square) {
    if (!selectedSquare.value) {
      return
    }

    const movesToTarget = legalMoves.value.filter((move) => move.to === target)
    if (movesToTarget.length === 0) {
      return
    }

    const promotionMoves = movesToTarget.filter((move) => Boolean(move.promotion))
    if (promotionMoves.length > 0) {
      const piece = game.get(selectedSquare.value)
      pendingPromotion.value = {
        from: selectedSquare.value,
        to: target,
        color: piece?.color ?? turnColor.value,
        moves: promotionMoves,
      }
      return
    }

    const moveToPlay = movesToTarget[0]!

    const executed = game.move({
      from: moveToPlay.from,
      to: moveToPlay.to,
      promotion: moveToPlay.promotion ?? 'q',
    })

    if (!executed) {
      return
    }

    lastMove.value = { from: executed.from as Square, to: executed.to as Square, san: executed.san }
    updateBoard()
    clearSelection()
    handlePostMove('player')
  }

  function reset(options?: { triggerAi?: boolean }) {
    const triggerAi =
      options?.triggerAi ??
      (isSetupComplete.value && mode.value === 'pvai' && aiColor.value === 'w')

    cancelAiComputation()
    pendingPromotion.value = null
    game.reset()
    updateBoard()
    lastMove.value = null
    clearSelection()
    showResultModal.value = false
    finalResultMessage.value = ''

    if (triggerAi && !game.isGameOver()) {
      void requestAiMove()
    }
  }

  function dismissResult() {
    showResultModal.value = false
  }

  function cancelAiComputation() {
    aiTaskId += 1
    isAiThinking.value = false
  }

  async function requestAiMove() {
    if (!isSetupComplete.value || pendingPromotion.value) {
      return
    }

    const currentTask = ++aiTaskId
    isAiThinking.value = true

    try {
      const depth = AI_DEPTH_MAP[aiDifficulty.value]
      const bestMove = await computeBestMove({ fen: game.fen(), depth, aiColor: aiColor.value })

      if (aiTaskId !== currentTask) {
        return
      }

      if (!bestMove) {
        refreshDerivedState()
        return
      }

      const executed = game.move({
        from: bestMove.from,
        to: bestMove.to,
        promotion: bestMove.promotion ?? 'q',
      })

      if (!executed) {
        refreshDerivedState()
        return
      }

      lastMove.value = {
        from: executed.from as Square,
        to: executed.to as Square,
        san: executed.san,
      }
      updateBoard()
      clearSelection()
      handlePostMove('ai')
    } catch (error) {
      if (aiTaskId === currentTask) {
        console.error('AI move computation failed', error)
      }
    } finally {
      if (aiTaskId === currentTask) {
        isAiThinking.value = false
      }
    }
  }

  function handlePostMove(actor: 'player' | 'ai') {
    if (
      actor === 'player' &&
      isAiEnabled.value &&
      isSetupComplete.value &&
      !game.isGameOver() &&
      game.turn() === aiColor.value
    ) {
      void requestAiMove()
    }
  }

  function promotePawn(promotion: PromotionPiece) {
    const pending = pendingPromotion.value
    if (!pending) {
      return
    }

    const moveToPlay = pending.moves.find((move) => move.promotion === promotion)

    pendingPromotion.value = null

    if (!moveToPlay) {
      clearSelection()
      return
    }

    const executed = game.move({
      from: moveToPlay.from,
      to: moveToPlay.to,
      promotion,
    })

    if (!executed) {
      refreshDerivedState()
      clearSelection()
      return
    }

    lastMove.value = {
      from: executed.from as Square,
      to: executed.to as Square,
      san: executed.san,
    }
    updateBoard()
    clearSelection()
    handlePostMove('player')
  }

  function beginSetup() {
    cancelAiComputation()
    isSetupComplete.value = false
  }

  function cancelSetup() {
    if (isSetupComplete.value) {
      return
    }
    isSetupComplete.value = true

    if (mode.value === 'pvai' && game.turn() === aiColor.value && !game.isGameOver()) {
      void requestAiMove()
    }
  }

  function applySetup(options: { mode: GameMode; aiDifficulty: AiDifficulty; aiColor: 'w' | 'b' }) {
    cancelAiComputation()
    mode.value = options.mode
    aiDifficulty.value = options.aiDifficulty
    aiColor.value = options.aiColor
    isSetupComplete.value = true
    reset({ triggerAi: options.mode === 'pvai' && options.aiColor === 'w' })
  }

  refreshDerivedState()

  return {
    board,
    selectedSquare,
    legalMoves,
    legalTargets,
    captureTargets,
    lastMove,
    history,
    turnLabel,
    opponentLabel,
    statusMessage,
    isGameOver,
    isCheck,
    turnColor,
    isSetupComplete,
    showResultModal,
    finalResultMessage,
    mode,
    isAiEnabled,
    aiDifficulty,
    aiColor,
    isAiThinking,
    pendingPromotion,
    selectSquare,
    reset,
    dismissResult,
    beginSetup,
    cancelSetup,
    applySetup,
    promotePawn,
  }
})
