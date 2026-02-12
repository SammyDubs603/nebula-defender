# Nebula Defender

Nebula Defender is a browser arcade shooter built with **Vite**, **TypeScript**, and **HTML5 Canvas**.

## Phase 3 Features

### Roguelike progression loop
- Wave-end **upgrade selection** overlay with 3 random cards
- Choose upgrades with `1/2/3` keys or mouse click
- Persistent stacking upgrades for the whole run
- In-run **Run Build** panel showing active upgrades
- Upgrade pool includes: Fire Rate, Damage, Projectile Speed, +Projectile spread, Pierce, Crit Chance, Magnet, Max HP, Max Shield, Shield Regen, Move Speed, and Thruster Dash

### Enemy variety + wave budgets
- Budget-based wave composition that scales smoothly each wave
- 6+ enemy archetypes with wave-based unlocks:
  - Basic Drifter
  - ZigZagger
  - Tank
  - Dasher
  - Shooter
  - Splitter (spawns 2 split drones on death)
- Existing Phase 2 boss fights remain every 5 waves

### Elites + combat juice
- Random elite enemy variants (larger + glow outline)
- Elite modifiers:
  - +50% HP
  - +20% speed
  - +25% score value
  - guaranteed pickup drop
- Floating damage numbers on enemy/boss hits
- Crit numbers are visually distinct
- Combo meter pulse feedback on multiplier increase
- Player combo streak glow effect when combo is `x3+`

### Existing systems retained and extended
- Boss warning + multi-phase boss patterns
- Screen shake, hit flash, particles, starfield, procedural sound
- Menus: start, settings, pause, game over

## Project Structure

- `src/entities/types.ts` — shared game entity and state types
- `src/entities/enemyDefs.ts` — enemy wave-budget and unlock specs
- `src/systems/game.ts` — update/render loop and core gameplay systems
- `src/systems/input.ts` — keyboard + pointer input
- `src/systems/audio.ts` — procedural Web Audio SFX
- `src/ui/upgrades.ts` — upgrade pool and run-upgrade helpers
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
- **Dash**: `Shift` (requires Thruster Dash upgrade)
- **Upgrade Select**: `1`, `2`, `3` or click card
- **Pause/Resume**: `Esc`
