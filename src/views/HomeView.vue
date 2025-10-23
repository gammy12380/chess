<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <div class="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12">
      <section class="space-y-4">
        <h1 class="text-4xl font-bold tracking-tight">西洋棋練習平台</h1>
        <p class="text-base text-slate-300">
          這個專案以 Vue 3、Pinia、Tailwind CSS 與 chess.js
          打造，提供從基礎規則、雙人對局、電腦訓練到線上房間的完整體驗。
        </p>
        <p class="text-base text-slate-300">
          左側選單可以快速切換到不同模式：了解棋規、與朋友對弈、挑戰電腦或建立線上房間。未來也會加入更多教學與分析工具，協助你精進棋藝。
        </p>
      </section>

      <section class="grid gap-6 md:grid-cols-2">
        <article class="rounded-2xl border border-slate-700/70 bg-slate-800/60 p-6">
          <h2 class="text-xl font-semibold text-white">雙人對戰</h2>
          <p class="mt-2 text-sm text-slate-300">
            與身旁夥伴輪流走子，支援所有規則與升變，適合練習實戰佈局與終局技巧。
          </p>
        </article>
        <article class="rounded-2xl border border-slate-700/70 bg-slate-800/60 p-6">
          <h2 class="text-xl font-semibold text-white">電腦對戰</h2>
          <p class="mt-2 text-sm text-slate-300">
            內建 Alpha-Beta 搜尋的 Web Worker AI，可調整難度與先手顏色，練習對抗不同強度的對手。
          </p>
        </article>
        <article class="rounded-2xl border border-slate-700/70 bg-slate-800/60 p-6">
          <h2 class="text-xl font-semibold text-white">連線房間</h2>
          <p class="mt-2 text-sm text-slate-300">
            以 Supabase Realtime 建立房間、同步棋局並邀請朋友加入，支援匿名暱稱與狀態追蹤。
          </p>
        </article>
        <article class="rounded-2xl border border-slate-700/70 bg-slate-800/60 p-6">
          <h2 class="text-xl font-semibold text-white">技術亮點</h2>
          <ul class="mt-2 space-y-2 text-sm text-slate-300">
            <li>GSAP 動畫呈現棋子移動、將軍與升變效果</li>
            <li>Web Worker 分擔 AI 搜尋，確保操作流暢</li>
            <li>Supabase 提供房間、玩家與棋局狀態存儲</li>
          </ul>
        </article>
      </section>
    </div>
  </div>
</template>
