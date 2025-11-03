# Vue Chess - 西洋棋練習平台

一個功能完整的現代化西洋棋練習平台，支援多種對戰模式，提供從基礎學習到進階訓練的完整體驗。

## 🎯 Demo

**[🔗 線上體驗](https://chess-wine-two-36.vercel.app/)**

## ✨ 專案特色

### 🎮 多種遊戲模式

- **雙人對戰** - 本地雙人輪流對弈，支援完整西洋棋規則
- **電腦對戰** - 內建 AI 引擎，可調整難度等級與先手選擇
- **連線對戰** - 即時線上對戰，支援房間系統與觀戰模式

### 🎨 優質體驗

- **流暢動畫** - 使用 GSAP 呈現棋子移動、將軍提示與升變效果
- **響應式設計** - 完美適配桌面與行動裝置
- **直覺操作** - 點擊選取、拖曳移動，支援所有西洋棋規則

### 🔧 技術亮點

- **Vue 3 + TypeScript** - 現代化前端框架與型別安全
- **Pinia 狀態管理** - 集中化遊戲狀態與邏輯處理
- **Web Worker AI** - 多執行緒 AI 運算，確保 UI 流暢度
- **Supabase 即時同步** - 雲端房間系統與即時對戰
- **Tailwind CSS** - 現代化 UI 設計系統

## 🛠️ 技術架構

### 前端技術棧

- **Vue 3** - 漸進式前端框架
- **TypeScript** - 靜態型別檢查
- **Pinia** - Vue 3 狀態管理方案
- **Vue Router** - 單頁應用路由
- **Tailwind CSS** - 實用優先的 CSS 框架
- **GSAP** - 高效能動畫引擎

### 核心依賴

- **chess.js** - 完整的西洋棋規則引擎
- **@supabase/supabase-js** - 即時資料庫與認證
- **Vite** - 快速構建工具

### AI 系統

- Alpha-Beta 剪枝搜尋演算法
- 位置評估與棋子價值計算
- Web Worker 多執行緒運算
- 可調整難度等級（1-3 層深度）

## 🚀 快速開始

### 環境需求

- Node.js ≥ 20.19.0 或 ≥ 22.12.0
- npm 或 bun

### 安裝與運行

```bash
# 克隆專案
git clone https://github.com/gammy12380/chess.git
cd vue-chess

# 安裝依賴
npm install
# 或使用 bun
bun install

# 啟動開發伺服器
npm run dev
# 或使用 bun
bun dev
```

專案將在 `http://localhost:5781` 啟動。

### 構建部署

```bash
# 類型檢查與構建
npm run build
# 或使用 bun
bun run build

# 預覽構建結果
npm run preview
```

### 開發工具

```bash
# ESLint 代碼檢查
npm run lint
# 或使用 bun
bun lint

# Prettier 代碼格式化
npm run format

# TypeScript 類型檢查
npm run type-check
```

## 📁 專案結構

```
src/
├── components/          # Vue 組件
│   ├── ChessBoard.vue      # 棋盤主組件
│   ├── ChessGameShell.vue  # 遊戲外殼
│   ├── GameResultModal.vue # 結果彈窗
│   ├── GameSetupModal.vue  # 設定彈窗
│   └── PromotionPicker.vue # 升變選擇器
├── stores/              # Pinia 狀態管理
│   └── chess.ts            # 棋局狀態與邏輯
├── utils/               # 工具函數
│   ├── ai.ts               # AI 引擎接口
│   ├── supabase.ts         # 資料庫配置
│   └── clientId.ts         # 客戶端識別
├── workers/             # Web Workers
│   └── aiWorker.ts         # AI 運算工作執行緒
├── views/               # 頁面組件
│   ├── HomeView.vue        # 首頁
│   ├── LocalGameView.vue   # 本地對戰
│   ├── AiGameView.vue      # AI 對戰
│   ├── OnlineGameView.vue  # 線上對戰
│   └── OnlineLobbyView.vue # 線上大廳
└── constants/           # 常數定義
    └── pieces.ts           # 棋子類型定義
```

## 🎯 功能說明

### 棋局核心功能

- ✅ 完整西洋棋規則實作
- ✅ 兵種升變（皇后、城堡、主教、騎士）
- ✅ 特殊走法（王車易位、過路兵）
- ✅ 將軍、將死、和棋檢測
- ✅ 移動歷史與悔棋功能

### AI 對戰系統

- ✅ Alpha-Beta 剪枝搜尋
- ✅ 三種難度等級
- ✅ 可選擇 AI 執棋顏色
- ✅ Web Worker 背景運算

### 線上對戰功能

- ✅ 即時房間建立與加入
- ✅ 玩家狀態同步
- ✅ 斷線重連機制
- ✅ 觀戰模式支援

## 🌐 部署

專案已部署至 Vercel，支援自動化 CI/CD：

- **生產環境**: https://chess-wine-two-36.vercel.app/
- **分支預覽**: 每個 Pull Request 自動生成預覽連結

### 環境變數設定

#### 本地開發

1. 複製環境變數範例檔案：

```bash
cp .env.example .env.local
```

2. 編輯 `.env.local` 並填入你的 Supabase 配置：

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Vercel 部署

1. 將專案推送至 GitHub
2. 在 Vercel 專案設定 → 環境變數中新增：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 設定適用範圍為 "Preview" 和 "Production"
4. 重新部署以使變更生效

### 安全注意事項

- Supabase anon key 設計為在瀏覽器中公開使用
- 必須啟用 RLS 並設定適當的存取政策來保護資料
- 如果曾經提交過 anon key，請在 Supabase Dashboard 中輪換金鑰

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

1. Fork 此專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📄 授權

此專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案。

## 👨‍💻 作者

**gammy12380** - [GitHub](https://github.com/gammy12380)

---

⭐ 如果這個專案對你有幫助，歡迎給個星星！
