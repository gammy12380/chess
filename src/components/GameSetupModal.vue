<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const modeOptions = [
  { value: 'pvp', label: '雙人對戰' },
  { value: 'pvai', label: '電腦對戰' },
] as const

const difficultyOptions = [
  { value: 'easy', label: '簡單' },
  { value: 'medium', label: '中階' },
  { value: 'hard', label: '困難' },
] as const

const props = defineProps<{
  open: boolean
  initialMode: 'pvp' | 'pvai'
  initialDifficulty: 'easy' | 'medium' | 'hard'
  initialAiColor: 'w' | 'b'
  allowedModes?: Array<'pvp' | 'pvai'>
  canCancel?: boolean
}>()

const emit = defineEmits<{
  confirm: [
    {
      mode: 'pvp' | 'pvai'
      aiDifficulty: 'easy' | 'medium' | 'hard'
      aiColor: 'w' | 'b'
    },
  ]
  cancel: []
}>()

const mode = ref<'pvp' | 'pvai'>(props.initialMode)
const aiDifficulty = ref<'easy' | 'medium' | 'hard'>(props.initialDifficulty)
const aiColor = ref<'w' | 'b'>(props.initialAiColor)

const availableModeOptions = computed(() => {
  if (!props.allowedModes || props.allowedModes.length === 0) {
    return modeOptions
  }
  return modeOptions.filter((option) => props.allowedModes?.includes(option.value))
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      mode.value = props.initialMode
      aiDifficulty.value = props.initialDifficulty
      aiColor.value = props.initialAiColor

      const firstAvailable = availableModeOptions.value[0]
      if (
        firstAvailable &&
        !availableModeOptions.value.some((option) => option.value === mode.value)
      ) {
        mode.value = firstAvailable.value
      }
    }
  },
)

watch(
  availableModeOptions,
  (options) => {
    const firstAvailable = options[0]
    if (firstAvailable && !options.some((option) => option.value === mode.value)) {
      mode.value = firstAvailable.value
    }
  },
  { immediate: true },
)

const isPvAi = computed(() => mode.value === 'pvai')

const canCancel = computed(() => props.canCancel === true)

function handleConfirm() {
  emit('confirm', {
    mode: mode.value,
    aiDifficulty: aiDifficulty.value,
    aiColor: aiColor.value,
  })
}

function handleCancel() {
  if (!canCancel.value) {
    return
  }
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-scale">
      <div
        v-if="open"
        class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/75 px-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="w-full max-w-lg rounded-2xl border border-slate-700/70 bg-slate-800/95 p-6">
          <header class="mb-6">
            <h2 class="text-2xl font-semibold text-white">建立遊戲</h2>
            <p class="mt-1 text-sm text-slate-300">請先完成遊戲設定，確認後即可開始對局。</p>
          </header>

          <div class="space-y-6 text-sm text-slate-200">
            <section>
              <h3 class="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">模式</h3>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in availableModeOptions"
                  :key="option.value"
                  type="button"
                  class="rounded-md border px-3 py-2 transition"
                  :class="
                    mode === option.value
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-600/60 hover:border-slate-500'
                  "
                  @click="mode = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </section>

            <section v-if="isPvAi">
              <h3 class="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">電腦設定</h3>
              <div class="space-y-4">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span class="text-slate-300">難度</span>
                  <div class="inline-flex rounded-md border border-slate-600/60 bg-slate-900/60">
                    <button
                      v-for="option in difficultyOptions"
                      :key="option.value"
                      type="button"
                      class="px-3 py-1.5 text-sm transition"
                      :class="
                        aiDifficulty === option.value
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'text-slate-200 hover:bg-slate-700/60'
                      "
                      @click="aiDifficulty = option.value"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>

                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span class="text-slate-300">玩家執棋</span>
                  <div class="inline-flex rounded-md border border-slate-600/60 bg-slate-900/60">
                    <button
                      type="button"
                      class="px-3 py-1.5 text-sm transition"
                      :class="
                        aiColor === 'b'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'text-slate-200 hover:bg-slate-700/60'
                      "
                      @click="aiColor = 'b'"
                    >
                      白方
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 text-sm transition"
                      :class="
                        aiColor === 'w'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'text-slate-200 hover:bg-slate-700/60'
                      "
                      @click="aiColor = 'w'"
                    >
                      黑方
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer class="mt-8 flex justify-end gap-3 text-sm">
            <button
              type="button"
              class="rounded-md border border-slate-600/70 px-4 py-2 text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!canCancel"
              @click="handleCancel"
            >
              取消
            </button>
            <button
              type="button"
              class="rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-900 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring focus-visible:ring-emerald-300"
              @click="handleConfirm"
            >
              開始對局
            </button>
          </footer>
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
