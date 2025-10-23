<script setup lang="ts">
import ChessGameShell from '@/components/ChessGameShell.vue'

const tips = [
  '可於設定中調整簡單、中階、困難三種 AI 搜尋深度。',
  '改變玩家執棋顏色即可體驗先手或後手的不同開局節奏。',
  '若 AI 思考時間較久，請稍候；計算完成會自動落子。',
]
</script>

<template>
  <ChessGameShell
    title="電腦對戰"
    description="挑戰內建 AI，透過調整難度與顏色練習不同情境。"
    :allowed-modes="['pvai']"
    default-mode="pvai"
    default-ai-difficulty="medium"
    default-ai-color="b"
    :tips="tips"
  />
</template>
