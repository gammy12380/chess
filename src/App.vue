<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { label: '專案介紹', to: '/' },
  { label: '雙人對戰', to: '/play/local' },
  { label: '電腦對戰', to: '/play/ai' },
  { label: '連線對戰', to: '/play/online' },
]

const activePath = computed(() => route.path)

function isActive(path: string) {
  if (path === '/') {
    return activePath.value === '/'
  }
  return activePath.value.startsWith(path)
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="flex min-h-screen flex-col lg:flex-row">
      <aside
        class="border-slate-800/80 bg-slate-900/80 backdrop-blur lg:flex lg:w-72 lg:flex-col lg:border-r"
      >
        <div class="flex items-center justify-between px-6 py-6 lg:block">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-white">Chess</h1>
            <p class="mt-1 text-xs text-slate-400">透過不同模式練習並挑戰你的棋藝。</p>
          </div>
        </div>
        <nav class="hidden flex-1 flex-col gap-2 px-4 pb-6 lg:flex">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="rounded-lg px-3 py-2 text-sm transition"
            :class="
              isActive(item.to)
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            "
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </aside>

      <header class="border-b border-slate-800/80 bg-slate-900/90 px-4 py-3 lg:hidden">
        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="rounded-full px-3 py-1 text-xs transition"
            :class="
              isActive(item.to)
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'border border-slate-700/70 text-slate-300 hover:text-white'
            "
          >
            {{ item.label }}
          </RouterLink>
        </div>
      </header>

      <main class="flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped></style>
