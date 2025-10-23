# vue-chess

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
bun install
```

### Compile and Hot-Reload for Development

```sh
bun dev
```

### Type-Check, Compile and Minify for Production

```sh
bun run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
bun lint
```

## Environment Variables & Deploying to Vercel

This project reads Supabase config from Vite environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Local development

1. Copy `.env.example` to `.env.local` and fill in your values. Files matching `.env*` are ignored by Git (except `.env.example`).

```
cp .env.example .env.local
# edit .env.local and set your values
```

2. Start the dev server as usual; Vite will load `.env.local` automatically.

### Deploy to Vercel

1. Push the repository to GitHub (do not commit `.env.local`).

2. In Vercel Project → Settings → Environment Variables, add:

- `VITE_SUPABASE_URL = https://YOUR-PROJECT-REF.supabase.co`
- `VITE_SUPABASE_ANON_KEY = <your-anon-key>`

Scope them to both “Preview” and “Production” (add separate values if needed). Re-deploy for changes to take effect.

3. No further config is required; Vercel detects Vite automatically.

### Security notes

- Supabase anon key is intended to be public in the browser, but you must enable RLS and write proper Policies to protect your data.
- If you previously committed your anon key, rotate it in Supabase Dashboard → Project Settings → API, then update `.env.local` and Vercel variables and redeploy.
