<script setup lang="ts">
import ChessGameShell from '@/components/ChessGameShell.vue'

const tips = [
  '白黑雙方在同一裝置輪流操作，棋盤會自動提示合法走法。',
  '可隨時點擊重新設定重新開局或調整升變後續選項。',
  '若想記錄棋譜，可使用右側歷史記錄或搭配螢幕錄影。',
]
</script>

<template>
  <ChessGameShell
    title="雙人對戰"
    description="在同一台裝置上輪流下棋，完整支援棋規、將軍偵測與升變流程。"
    :allowed-modes="['pvp']"
    default-mode="pvp"
    :tips="tips"
  />
</template>
