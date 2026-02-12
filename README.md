# Nebula Defender

Nebula Defender is a browser arcade shooter built with **Vite**, **TypeScript**, and **HTML5 Canvas**.

## Phase 1 Features

- Vite + TypeScript app scaffold
- Fixed-size 16:9 canvas playfield
- Main game loop with `requestAnimationFrame`
- Player ship movement (WASD or Arrow keys)
- Continuous shooting (Space or mouse/pointer hold)

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite (typically `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

## Deploy

This project outputs static assets and can be deployed to any static hosting provider.

1. Build assets:
   ```bash
   npm run build
   ```
2. Deploy the generated `dist/` directory.

Examples: Vercel (static project), Netlify, Cloudflare Pages, GitHub Pages.

## Controls

- **Move**: `W/A/S/D` or Arrow keys
- **Shoot**: `Space` or hold mouse button on canvas
