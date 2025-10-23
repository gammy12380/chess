<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'

import ChessBoard from '@/components/ChessBoard.vue'
import GameResultModal from '@/components/GameResultModal.vue'
import GameSetupModal from '@/components/GameSetupModal.vue'
import PromotionPicker from '@/components/PromotionPicker.vue'
import { PROMOTION_ORDER, type PromotionPiece } from '@/constants/pieces'
import { useChessStore } from '@/stores/chess'

const props = defineProps<{
  title: string
  description: string
  allowedModes: Array<'pvp' | 'pvai'>
  defaultMode: 'pvp' | 'pvai'
  defaultAiDifficulty?: 'easy' | 'medium' | 'hard'
  defaultAiColor?: 'w' | 'b'
  tips?: string[]
}>()

const chessStore = useChessStore()
const {
  statusMessage,
  isGameOver,
  turnLabel,
  opponentLabel,
  mode,
  aiDifficulty,
  isAiEnabled,
  isAiThinking,
  aiColor,
  showResultModal,
  finalResultMessage,
  isSetupComplete,
  pendingPromotion,
} = storeToRefs(chessStore)

const { reset, dismissResult, beginSetup, cancelSetup, applySetup, promotePawn } = chessStore

const showSetupModal = ref(false)
const allowSetupCancel = ref(false)

const normalizedAllowedModes = computed(() =>
  props.allowedModes.length > 0 ? props.allowedModes : (['pvp', 'pvai'] as Array<'pvp' | 'pvai'>),
)

const defaultTips = [
  '選擇好模式後先完成設定才能開始對局。',
  '點選己方棋子即可看到合法移動位置，紅框代表可吃子。',
  '將軍時畫面會高亮提示，請盡速化解危機。',
  '兵走到底線時會跳出升變選單，可自由選擇升變棋子。',
  '重新設定可調整遊戲模式與參數，重新開始可立即回到開局。',
]

const sidebarTips = computed(() => (props.tips && props.tips.length > 0 ? props.tips : defaultTips))

const modeLabel = computed(() => (mode.value === 'pvp' ? '雙人對戰' : '電腦對戰'))
const difficultyLabel = computed(() => {
  if (aiDifficulty.value === 'easy') {
    return '簡單'
  }
  if (aiDifficulty.value === 'medium') {
    return '中階'
  }
  return '困難'
})
const playerColorLabel = computed(() => (aiColor.value === 'b' ? '白方' : '黑方'))
const promotionOptions = computed<PromotionPiece[]>(() => {
  if (!pendingPromotion.value) {
    return []
  }
  const available = new Set(
    pendingPromotion.value.moves
      .map((move) => move.promotion)
      .filter((value): value is PromotionPiece => Boolean(value)),
  )
  return PROMOTION_ORDER.filter((type) => available.has(type))
})
const promotionColor = computed(() => pendingPromotion.value?.color ?? 'w')

function openSetup(allowCancel: boolean) {
  allowSetupCancel.value = allowCancel
  beginSetup()
  showSetupModal.value = true
}

function initializeForRoute() {
  if (!normalizedAllowedModes.value.includes(props.defaultMode)) {
    throw new Error('defaultMode must be included in allowedModes')
  }

  mode.value = props.defaultMode
  if (props.defaultAiDifficulty) {
    aiDifficulty.value = props.defaultAiDifficulty
  }
  if (props.defaultAiColor) {
    aiColor.value = props.defaultAiColor
  } else if (mode.value === 'pvai' && aiColor.value !== 'b' && aiColor.value !== 'w') {
    aiColor.value = 'b'
  }

  reset({ triggerAi: false })
  openSetup(false)
}

watchEffect(() => {
  if (!normalizedAllowedModes.value.includes(mode.value)) {
    mode.value = props.defaultMode
  }
})

onMounted(() => {
  initializeForRoute()
})

function handleSetupConfirm(payload: {
  mode: 'pvp' | 'pvai'
  aiDifficulty: 'easy' | 'medium' | 'hard'
  aiColor: 'w' | 'b'
}) {
  applySetup(payload)
  showSetupModal.value = false
  allowSetupCancel.value = true
}

function handleSetupCancel() {
  cancelSetup()
  showSetupModal.value = false
}

function handleReconfigure() {
  openSetup(true)
}

function handleReset() {
  reset()
}

function handlePromotionSelect(option: PromotionPiece) {
  promotePawn(option)
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <div class="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 lg:flex-row lg:items-start">
      <div class="flex-1 space-y-6">
        <header class="space-y-3">
          <h1 class="text-4xl font-bold tracking-tight">{{ title }}</h1>
          <p class="text-sm text-slate-300">{{ description }}</p>
          <div class="flex flex-wrap items-center gap-2 text-sm text-slate-200">
            <span class="rounded-md border border-slate-600/60 px-3 py-1"
              >輪到：{{ turnLabel }}</span
            >
            <span class="rounded-md border border-slate-600/60 px-3 py-1"
              >對手：{{ opponentLabel }}</span
            >
            <span class="rounded-md border border-slate-600/60 px-3 py-1"
              >模式：{{ modeLabel }}</span
            >
            <span v-if="isAiEnabled" class="rounded-md border border-slate-600/60 px-3 py-1"
              >難度：{{ difficultyLabel }}</span
            >
            <span v-if="isAiEnabled" class="rounded-md border border-slate-600/60 px-3 py-1"
              >玩家執棋：{{ playerColorLabel }}</span
            >
            <button
              type="button"
              class="rounded-md border border-emerald-400/70 px-3 py-1 text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!isSetupComplete"
              @click="handleReconfigure"
            >
              重新設定
            </button>
            <button
              type="button"
              class="rounded-md bg-emerald-500 px-3 py-1 font-semibold text-slate-900 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!isSetupComplete"
              @click="handleReset"
            >
              重新開始
            </button>
          </div>
          <p v-if="!isSetupComplete" class="text-sm text-amber-200">請先完成設定以開始遊戲。</p>
          <p v-else-if="statusMessage" class="text-sm text-amber-300">{{ statusMessage }}</p>
          <p v-else-if="isGameOver" class="text-sm text-amber-300">對局結束，請重置遊戲。</p>
          <p v-else-if="isAiEnabled && isAiThinking" class="text-sm text-emerald-200">
            電腦思考中，請稍候...
          </p>
        </header>

        <ChessBoard />
      </div>

      <aside
        class="w-full max-w-xs rounded-xl border border-slate-700/70 bg-slate-800/60 p-5 text-sm text-slate-200"
      >
        <h2 class="mb-3 text-lg font-semibold text-white">玩法說明</h2>
        <ul class="space-y-2 leading-relaxed">
          <li v-for="tip in sidebarTips" :key="tip">{{ tip }}</li>
        </ul>
      </aside>
    </div>
    <GameResultModal
      :open="showResultModal"
      :message="finalResultMessage"
      :status="statusMessage"
      @restart="reset"
      @close="dismissResult"
    />
    <GameSetupModal
      :open="showSetupModal"
      :initial-mode="mode"
      :initial-difficulty="aiDifficulty"
      :initial-ai-color="aiColor"
      :allowed-modes="normalizedAllowedModes"
      :can-cancel="allowSetupCancel"
      @confirm="handleSetupConfirm"
      @cancel="handleSetupCancel"
    />
    <PromotionPicker
      :open="Boolean(pendingPromotion)"
      :color="promotionColor"
      :options="promotionOptions"
      @select="handlePromotionSelect"
    />
  </div>
</template>

<style scoped></style>
