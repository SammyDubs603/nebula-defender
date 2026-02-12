# Nebula Defender

Nebula Defender is a browser arcade shooter built with **Vite**, **TypeScript**, and **HTML5 Canvas**.

## Phase 2 Features

### Enemies + scoring
- Wave-based enemy spawning with a scaling difficulty curve
- Bullet vs enemy and enemy vs player collision systems
- Score system with combo multiplier and persistent high score (`localStorage`)
- Health and shield pickups
- Particle explosions on impacts and kills

### Modern arcade feel
- Acceleration + damping player movement
- Screen shake and hit flash feedback
- Multi-layer parallax starfield
- Thruster particle effects while moving
- Procedural Web Audio sound effects (no assets)

### Boss system
- Boss encounter every 5 waves
- Boss HP bar
- Multiple bullet attack patterns
- Phase transitions at 70% and 30% HP
- WARNING banner and short slow-motion intro sequence

### Game flow screens
- Start Menu
- Settings (sound + screen shake)
- Pause Menu
- Game Over screen with score recap

## Project Structure

- `src/entities/types.ts` — shared game entity and state types
- `src/systems/game.ts` — update/render loop and core gameplay systems
- `src/systems/input.ts` — keyboard + pointer input
- `src/systems/audio.ts` — procedural Web Audio SFX
- `src/utils/math.ts` — math helpers
- `src/utils/storage.ts` — localStorage settings/high score persistence
- `src/main.ts` — app bootstrap + UI wiring
- `src/style.css` — game shell and overlay styling

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

## Controls

- **Move**: `W/A/S/D` or Arrow keys
- **Shoot**: `Space` or hold mouse/touch on canvas
- **Pause/Resume**: `Esc`
