<script setup lang="ts">
import { computed } from 'vue'

import {
  PIECE_IMAGES,
  PIECE_LABELS,
  PROMOTION_ORDER,
  type PromotionPiece,
} from '@/constants/pieces'

const props = defineProps<{
  open: boolean
  color: 'w' | 'b'
  options: PromotionPiece[]
}>()

const emit = defineEmits<{
  select: [PromotionPiece]
}>()

const displayOptions = computed(() => {
  const allowed = new Set(props.options)
  const ordered = PROMOTION_ORDER.filter((type) => allowed.size === 0 || allowed.has(type))
  return ordered.map((type) => ({
    type,
    label: PIECE_LABELS[type],
    image: PIECE_IMAGES[props.color][type],
  }))
})

function handleSelect(option: PromotionPiece) {
  emit('select', option)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-scale">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 px-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="w-full max-w-sm rounded-2xl border border-slate-700/70 bg-slate-800/95 p-6">
          <header class="mb-4 text-center">
            <h2 class="text-xl font-semibold text-white">選擇升變棋子</h2>
            <p class="mt-1 text-sm text-slate-300">兵抵達底線，請指定要升變的棋子。</p>
          </header>
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="option in displayOptions"
              :key="option.type"
              type="button"
              class="group flex flex-col items-center gap-2 rounded-lg border border-slate-600/70 bg-slate-900/60 px-3 py-3 text-slate-100 transition hover:border-emerald-400/80 hover:text-emerald-200 focus:outline-none focus-visible:ring focus-visible:ring-emerald-300"
              @click="handleSelect(option.type)"
            >
              <span class="flex h-16 w-16 items-center justify-center">
                <img :src="option.image" :alt="option.label" class="h-full w-full object-contain" />
              </span>
              <span class="text-sm font-medium">{{ option.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
