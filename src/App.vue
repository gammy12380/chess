<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import ChessBoard from '@/components/ChessBoard.vue'
import GameResultModal from '@/components/GameResultModal.vue'
import GameSetupModal from '@/components/GameSetupModal.vue'
import PromotionPicker from '@/components/PromotionPicker.vue'
import { PROMOTION_ORDER, type PromotionPiece } from '@/constants/pieces'
import { useChessStore } from '@/stores/chess'

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

if (!isSetupComplete.value) {
  openSetup(false)
}

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
          <h1 class="text-4xl font-bold tracking-tight">Chess</h1>
          <p class="text-sm text-slate-300">
            使用 Vue 3、Tailwind CSS、chess.js 與 GSAP 建構的 2D 西洋棋練習專案。
          </p>
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
          <li>選擇「雙人對戰」即可兩人輪流下棋；選擇「電腦對戰」可與 AI 對弈。</li>
          <li>
            電腦對戰模式可在開局設定畫面中選擇難度與玩家執棋顏色，需要調整時請使用「重新設定」。
          </li>
          <li>點擊己方棋子以查看可移動的格子，再次點擊目標格子完成移動。</li>
          <li>合法移動會以圓點與紅框提示，最近一步會以淡黃色高亮顯示。</li>
          <li>對局結束條件：將死視為勝負、僵局／三次重複局面／五十步規則或子力不足皆為和局。</li>
          <li>兵抵達底線會跳出升變選單，選擇欲升變的棋子；點擊「重新開始」可回到開局。</li>
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
