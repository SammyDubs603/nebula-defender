import './style.css';
import { InputState } from './systems/input';
import { NebulaDefenderGame } from './systems/game';
import { loadSettings, saveSettings } from './utils/storage';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root element');
}

app.innerHTML = `
  <section class="game-shell" aria-label="Nebula Defender game area">
    <header class="hud">
      <span class="hud__title">NEBULA DEFENDER — PHASE 3</span>
      <span class="hud__hint">Move: WASD / Arrows • Shoot: Space / Mouse • Dash: Shift • Pause: Esc</span>
    </header>
    <div class="canvas-wrap">
      <canvas width="${GAME_WIDTH}" height="${GAME_HEIGHT}" aria-label="Nebula Defender playfield"></canvas>
      <div class="overlay" id="overlay"></div>
    </div>
  </section>
`;

const canvas = app.querySelector<HTMLCanvasElement>('canvas');
const overlay = app.querySelector<HTMLDivElement>('#overlay');
if (!canvas || !overlay) {
  throw new Error('Canvas initialization failed');
}

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('2D context unavailable');
}

const settings = loadSettings();
const input = new InputState(canvas);
const game = new NebulaDefenderGame(context, input, overlay, settings);

overlay.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const action = target.dataset.action;
  const upgradeIndex = target.dataset.upgradeIndex;

  if (upgradeIndex) {
    game.chooseUpgrade(Number(upgradeIndex));
  } else if (action === 'start') {
    game.restart();
  } else if (action === 'settings') {
    game.setState('settings');
  } else if (action === 'back' || action === 'menu') {
    game.setState('menu');
  } else if (action === 'resume') {
    game.setState('playing');
  } else if (action === 'restart') {
    game.restart();
  }
});

overlay.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  const setting = target.dataset.setting;
  if (!setting) return;

  if (setting === 'sound') {
    settings.soundEnabled = target.checked;
  } else if (setting === 'shake') {
    settings.screenshake = target.checked;
  }

  saveSettings(settings);
  game.applySettings(settings);
});

game.start();

window.addEventListener('beforeunload', () => {
  input.destroy();
});
