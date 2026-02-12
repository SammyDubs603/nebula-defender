import './style.css';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const PLAYER_SPEED = 420;
const BULLET_SPEED = 700;
const BULLET_COOLDOWN = 0.18;

type Vec2 = {
  x: number;
  y: number;
};

type Bullet = {
  position: Vec2;
  radius: number;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root element');
}

app.innerHTML = `
  <div class="game-shell">
    <header>
      <span>NEBULA DEFENDER — PHASE 1</span>
      <span>Move: WASD / Arrows • Shoot: Space / Mouse</span>
    </header>
    <canvas width="${GAME_WIDTH}" height="${GAME_HEIGHT}" aria-label="Nebula Defender game field"></canvas>
  </div>
`;

const canvas = app.querySelector<HTMLCanvasElement>('canvas');
if (!canvas) {
  throw new Error('Canvas initialization failed');
}

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('2D context unavailable');
}

const keys = new Set<string>();
const bullets: Bullet[] = [];

const player = {
  position: { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 70 },
  width: 42,
  height: 28,
  color: '#8fd3ff',
};

let lastTimestamp = 0;
let fireCooldown = 0;
let pointerPressed = false;

const shoot = (): void => {
  bullets.push({
    position: {
      x: player.position.x,
      y: player.position.y - player.height / 2,
    },
    radius: 4,
  });
};

const onKeyDown = (event: KeyboardEvent): void => {
  keys.add(event.code);
};

const onKeyUp = (event: KeyboardEvent): void => {
  keys.delete(event.code);
};

const onPointerDown = (): void => {
  pointerPressed = true;
};

const onPointerUp = (): void => {
  pointerPressed = false;
};

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointerup', onPointerUp);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const updatePlayer = (deltaTime: number): void => {
  const direction: Vec2 = { x: 0, y: 0 };

  if (keys.has('ArrowLeft') || keys.has('KeyA')) direction.x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) direction.x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) direction.y -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) direction.y += 1;

  if (direction.x !== 0 && direction.y !== 0) {
    const normalizer = Math.SQRT1_2;
    direction.x *= normalizer;
    direction.y *= normalizer;
  }

  player.position.x += direction.x * PLAYER_SPEED * deltaTime;
  player.position.y += direction.y * PLAYER_SPEED * deltaTime;

  player.position.x = clamp(player.position.x, player.width / 2, GAME_WIDTH - player.width / 2);
  player.position.y = clamp(player.position.y, player.height / 2, GAME_HEIGHT - player.height / 2);
};

const updateBullets = (deltaTime: number): void => {
  for (let index = bullets.length - 1; index >= 0; index -= 1) {
    const bullet = bullets[index];
    bullet.position.y -= BULLET_SPEED * deltaTime;

    if (bullet.position.y + bullet.radius < 0) {
      bullets.splice(index, 1);
    }
  }
};

const updateShooting = (deltaTime: number): void => {
  fireCooldown -= deltaTime;

  const keyboardShooting = keys.has('Space');
  if ((keyboardShooting || pointerPressed) && fireCooldown <= 0) {
    shoot();
    fireCooldown = BULLET_COOLDOWN;
  }
};

const renderBackground = (): void => {
  context.fillStyle = '#030714';
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  context.fillStyle = 'rgba(167, 191, 255, 0.7)';
  for (let i = 0; i < 60; i += 1) {
    const x = (i * 157) % GAME_WIDTH;
    const y = (i * 89) % GAME_HEIGHT;
    context.fillRect(x, y, 1.5, 1.5);
  }
};

const renderPlayer = (): void => {
  const { x, y } = player.position;

  context.save();
  context.translate(x, y);

  context.fillStyle = player.color;
  context.beginPath();
  context.moveTo(0, -player.height / 2);
  context.lineTo(player.width / 2, player.height / 2);
  context.lineTo(0, player.height / 4);
  context.lineTo(-player.width / 2, player.height / 2);
  context.closePath();
  context.fill();

  context.fillStyle = '#4da1ff';
  context.fillRect(-4, -2, 8, 12);
  context.restore();
};

const renderBullets = (): void => {
  context.fillStyle = '#ffe699';
  bullets.forEach((bullet) => {
    context.beginPath();
    context.arc(bullet.position.x, bullet.position.y, bullet.radius, 0, Math.PI * 2);
    context.fill();
  });
};

const renderHud = (): void => {
  context.fillStyle = '#d8e3ff';
  context.font = '18px Inter, sans-serif';
  context.fillText(`Shots in flight: ${bullets.length}`, 20, 32);
};

const tick = (timestamp: number): void => {
  const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.033);
  lastTimestamp = timestamp;

  updatePlayer(deltaTime);
  updateShooting(deltaTime);
  updateBullets(deltaTime);

  renderBackground();
  renderPlayer();
  renderBullets();
  renderHud();

  requestAnimationFrame(tick);
};

requestAnimationFrame((timestamp) => {
  lastTimestamp = timestamp;
  requestAnimationFrame(tick);
});
