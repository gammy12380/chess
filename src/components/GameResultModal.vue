<script setup lang="ts">
const props = defineProps({
  open: { type: Boolean, required: true },
  message: { type: String, required: true },
  status: { type: String, default: '' },
  confirmLabel: { type: String, default: '重新開始' },
})

const emit = defineEmits<{ close: []; restart: [] }>()

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <teleport to="body">
    <transition name="fade">
      <div
        v-if="props.open"
        class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4"
        @click="handleBackdropClick"
      >
        <transition name="modal">
          <div
            v-if="props.open"
            class="w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 text-slate-100 shadow-2xl"
          >
            <header class="bg-slate-800/80 px-6 py-4">
              <h2 class="text-lg font-semibold">對局結束</h2>
            </header>
            <div class="space-y-3 px-6 py-6 text-sm">
              <p class="text-xl font-bold text-emerald-300">{{ props.message }}</p>
              <p v-if="props.status" class="text-slate-300">{{ props.status }}</p>
              <p class="text-xs text-slate-500">您可以選擇重新開始一局，或關閉此視窗回顧棋局。</p>
            </div>
            <footer class="flex flex-wrap gap-2 bg-slate-800/60 px-6 py-4">
              <button
                type="button"
                class="flex-1 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-400 hover:text-slate-100"
                @click="emit('close')"
              >
                關閉
              </button>
              <button
                type="button"
                class="flex-1 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring focus-visible:ring-emerald-300"
                @click="emit('restart')"
              >
                {{ props.confirmLabel }}
              </button>
            </footer>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-enter-active {
  animation: pop-in 0.28s ease;
}

.modal-leave-active {
  animation: pop-out 0.2s ease forwards;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.88) translateY(12px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes pop-out {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.92) translateY(12px);
  }
}
</style>
