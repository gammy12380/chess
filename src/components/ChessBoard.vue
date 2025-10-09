<script setup lang="ts">
import type { Square } from 'chess.js'

import { computed, nextTick, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { gsap } from 'gsap'

import { useChessStore } from '@/stores/chess'

import { PIECE_IMAGES, PIECE_LABELS, type PieceType } from '@/constants/pieces'

const chessStore = useChessStore()
const {
  board,
  selectedSquare,
  legalTargets,
  captureTargets,
  lastMove,
  turnLabel,
  opponentLabel,
  statusMessage,
  isGameOver,
  isCheck,
  turnColor,
} = storeToRefs(chessStore)

const { selectSquare } = chessStore

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

const squareRefs = new Map<Square, HTMLElement>()
const pieceRefs = new Map<Square, HTMLElement>()

const toSquare = (fileIndex: number, rankIndex: number): Square =>
  `${files[fileIndex]}${8 - rankIndex}` as Square

const registerSquare = (square: Square, el: HTMLElement | null) => {
  if (!el) {
    squareRefs.delete(square)
    return
  }
  squareRefs.set(square, el)
}

const registerPiece = (square: Square, el: HTMLElement | null) => {
  if (!el) {
    pieceRefs.delete(square)
    return
  }
  pieceRefs.set(square, el)
}

const getSquareClasses = (row: number, col: number, square: Square) => {
  const classes = [
    'relative',
    'aspect-square',
    'flex',
    'items-center',
    'justify-center',
    'transition-[transform,background-color]',
    'duration-200',
    'focus-visible:outline-none',
  ]

  const isLight = (row + col) % 2 === 0
  classes.push(isLight ? 'bg-stone-200' : 'bg-emerald-800')

  const isCheckedSquare = checkedKingSquare.value === square

  if (isCheckedSquare) {
    classes.push('z-10', 'shadow-[0_0_18px_rgba(244,63,94,0.65)]')
  } else if (selectedSquare.value === square) {
    classes.push('ring-4', 'ring-amber-300/70', 'ring-inset')
  }

  if (lastMove.value && (lastMove.value.from === square || lastMove.value.to === square)) {
    classes.push('bg-amber-200/60')
  }

  if (isLegalDestination(square)) {
    classes.push('hover:scale-[1.03]')
  }

  return classes.join(' ')
}

const getPieceClasses = () => {
  const classes = [
    'piece',
    'relative',
    'z-10',
    'flex',
    'h-full',
    'w-full',
    'items-center',
    'justify-center',
    'select-none',
    'drop-shadow-[0_4px_4px_rgba(8,15,31,0.55)]',
  ]
  return classes.join(' ')
}

const isLegalDestination = (square: Square) => legalTargets.value.has(square)

const isCaptureDestination = (square: Square) => captureTargets.value.has(square)

const pieceImage = (pieceType: string, pieceColor: 'w' | 'b') => {
  const key = pieceType as PieceType
  return PIECE_IMAGES[pieceColor][key] ?? ''
}

const pieceAlt = (pieceType: string, pieceColor: 'w' | 'b') => {
  const colorLabel = pieceColor === 'w' ? '白色' : '黑色'
  const name = PIECE_LABELS[pieceType as PieceType] ?? '棋子'
  return `${colorLabel}${name}`
}

const handleSquareClick = (square: Square) => {
  selectSquare(square)
}

const checkedKingSquare = computed<Square | null>(() => {
  if (!isCheck.value) {
    return null
  }

  for (let rowIndex = 0; rowIndex < board.value.length; rowIndex += 1) {
    const row = board.value[rowIndex]
    if (!row) {
      continue
    }
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const piece = row[colIndex]
      if (piece && piece.type === 'k' && piece.color === turnColor.value) {
        return toSquare(colIndex, rowIndex)
      }
    }
  }

  return null
})

watch(lastMove, async (move) => {
  if (!move) {
    return
  }
  await nextTick()
  const targetPiece = pieceRefs.get(move.to)
  if (targetPiece) {
    gsap.fromTo(
      targetPiece,
      { scale: 0.85, rotation: -6, opacity: 0.6 },
      { scale: 1.05, rotation: 0, opacity: 1, duration: 0.4, ease: 'elastic.out(1, 0.6)' },
    )
  }
})

watch(selectedSquare, async (square) => {
  if (!square) {
    return
  }
  await nextTick()
  const element = squareRefs.get(square)
  if (element) {
    gsap.fromTo(
      element,
      { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0.65)' },
      { boxShadow: '0 0 0 12px rgba(251, 191, 36, 0)', duration: 0.45, ease: 'power1.out' },
    )
  }
})

watch(checkedKingSquare, async (square) => {
  if (!square) {
    return
  }
  await nextTick()
  const targetPiece = pieceRefs.get(square)
  if (targetPiece) {
    gsap.fromTo(
      targetPiece,
      { scale: 1, boxShadow: '0 0 0 rgba(248,113,113,0.8)' },
      {
        scale: 1.12,
        boxShadow: '0 0 24px rgba(248,113,113,0.85)',
        yoyo: true,
        repeat: 2,
        duration: 0.18,
        ease: 'power1.inOut',
      },
    )
  }
})

onBeforeUnmount(() => {
  squareRefs.clear()
  pieceRefs.clear()
})
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
      <div class="space-y-1">
        <p>
          輪到：<span class="font-semibold text-white">{{ turnLabel }}</span>
        </p>
        <p v-if="statusMessage" class="text-amber-300">{{ statusMessage }}</p>
        <p v-else-if="isGameOver" class="text-amber-300">對局結束，請重置遊戲。</p>
      </div>
      <div
        class="rounded-md border border-slate-600/60 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-slate-200"
      >
        {{ opponentLabel }} 後手
      </div>
    </div>

    <div class="mx-auto max-w-[min(90vw,560px)]">
      <div
        class="relative aspect-square select-none overflow-hidden rounded-2xl border-8 border-stone-700 shadow-2xl"
      >
        <div class="grid h-full grid-cols-8 grid-rows-8">
          <template v-for="(row, rowIndex) in board" :key="`row-${rowIndex}`">
            <template v-for="(piece, colIndex) in row" :key="`square-${rowIndex}-${colIndex}`">
              <button
                type="button"
                :ref="
                  (el) => registerSquare(toSquare(colIndex, rowIndex), el as HTMLElement | null)
                "
                :class="getSquareClasses(rowIndex, colIndex, toSquare(colIndex, rowIndex))"
                @click="handleSquareClick(toSquare(colIndex, rowIndex))"
              >
                <span
                  v-if="piece"
                  :ref="
                    (el) => registerPiece(toSquare(colIndex, rowIndex), el as HTMLElement | null)
                  "
                  :class="getPieceClasses()"
                >
                  <img
                    :src="pieceImage(piece.type, piece.color)"
                    :alt="pieceAlt(piece.type, piece.color)"
                    class="pointer-events-none h-[76%] w-[76%] object-contain"
                  />
                </span>

                <span
                  v-else-if="selectedSquare && isLegalDestination(toSquare(colIndex, rowIndex))"
                  class="absolute h-4 w-4 rounded-full bg-slate-900/40"
                />

                <span
                  v-if="isCaptureDestination(toSquare(colIndex, rowIndex)) && piece"
                  class="absolute inset-1 rounded-full border-4 border-rose-500/80"
                />

                <span
                  v-if="checkedKingSquare === toSquare(colIndex, rowIndex)"
                  class="pointer-events-none absolute inset-[12%] rounded-2xl border-[3px] border-rose-500/80 bg-rose-500/15 shadow-[0_0_22px_rgba(244,63,94,0.65)] animate-pulse"
                />

                <span
                  v-if="checkedKingSquare === toSquare(colIndex, rowIndex)"
                  class="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.75)]"
                >
                  ⚠
                </span>

                <span
                  class="pointer-events-none absolute left-1 top-1 text-[10px] font-semibold text-slate-500/70"
                >
                  {{ files[colIndex] }}{{ 8 - rowIndex }}
                </span>
              </button>
            </template>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
