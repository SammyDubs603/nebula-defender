import './style.css';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const PLAYER_SPEED = 420;
const BULLET_SPEED = 720;
const BULLET_COOLDOWN_SECONDS = 0.16;

type Vec2 = {
  x: number;
  y: number;
};

type Bullet = {
  position: Vec2;
  radius: number;
};

type Player = {
  position: Vec2;
  width: number;
  height: number;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root element');
}

app.innerHTML = `
  <section class="game-shell" aria-label="Nebula Defender game area">
    <header class="hud">
      <span class="hud__title">NEBULA DEFENDER — PHASE 1</span>
      <span class="hud__hint">Move: WASD / Arrows • Shoot: Space / Mouse</span>
    </header>
    <canvas width="${GAME_WIDTH}" height="${GAME_HEIGHT}" aria-label="Nebula Defender playfield"></canvas>
  </section>
`;

const canvas = app.querySelector<HTMLCanvasElement>('canvas');
if (!canvas) {
  throw new Error('Canvas initialization failed');
}

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('2D context unavailable');
}

class InputState {
  private pressed = new Set<string>();

  private pointerHeld = false;

  constructor(private readonly listenElement: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.listenElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  isShooting(): boolean {
    return this.pointerHeld || this.pressed.has('Space');
  }

  movementAxis(): Vec2 {
    const axis = { x: 0, y: 0 };

    if (this.pressed.has('ArrowLeft') || this.pressed.has('KeyA')) axis.x -= 1;
    if (this.pressed.has('ArrowRight') || this.pressed.has('KeyD')) axis.x += 1;
    if (this.pressed.has('ArrowUp') || this.pressed.has('KeyW')) axis.y -= 1;
    if (this.pressed.has('ArrowDown') || this.pressed.has('KeyS')) axis.y += 1;

    if (axis.x !== 0 && axis.y !== 0) {
      axis.x *= Math.SQRT1_2;
      axis.y *= Math.SQRT1_2;
    }

    return axis;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.listenElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space' || event.code.startsWith('Arrow')) {
      event.preventDefault();
    }

    this.pressed.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.pointerHeld = true;
  };

  private onPointerUp = (): void => {
    this.pointerHeld = false;
  };
}

class NebulaDefenderGame {
  private player: Player = {
    position: { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 70 },
    width: 42,
    height: 28,
  };

  private bullets: Bullet[] = [];

  private fireCooldownSeconds = 0;

  private lastTimestamp = 0;

  private readonly stars = this.createStarField();

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly input: InputState,
  ) {}

  start(): void {
    requestAnimationFrame((initialTimestamp) => {
      this.lastTimestamp = initialTimestamp;
      requestAnimationFrame(this.tick);
    });
  }

  private tick = (timestamp: number): void => {
    const deltaSeconds = Math.min((timestamp - this.lastTimestamp) / 1000, 0.033);
    this.lastTimestamp = timestamp;

    this.update(deltaSeconds);
    this.render();

    requestAnimationFrame(this.tick);
  };

  private update(deltaSeconds: number): void {
    const axis = this.input.movementAxis();

    this.player.position.x += axis.x * PLAYER_SPEED * deltaSeconds;
    this.player.position.y += axis.y * PLAYER_SPEED * deltaSeconds;

    this.player.position.x = clamp(this.player.position.x, this.player.width / 2, GAME_WIDTH - this.player.width / 2);
    this.player.position.y = clamp(this.player.position.y, this.player.height / 2, GAME_HEIGHT - this.player.height / 2);

    this.fireCooldownSeconds -= deltaSeconds;

    if (this.input.isShooting() && this.fireCooldownSeconds <= 0) {
      this.spawnBullet();
      this.fireCooldownSeconds = BULLET_COOLDOWN_SECONDS;
    }

    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      bullet.position.y -= BULLET_SPEED * deltaSeconds;

      if (bullet.position.y + bullet.radius < 0) {
        this.bullets.splice(index, 1);
      }
    }
  }

  private render(): void {
    this.renderBackground();
    this.renderPlayer();
    this.renderBullets();
    this.renderHudText();
  }

  private spawnBullet(): void {
    this.bullets.push({
      position: {
        x: this.player.position.x,
        y: this.player.position.y - this.player.height / 2,
      },
      radius: 4,
    });
  }

  private renderBackground(): void {
    this.ctx.fillStyle = '#030714';
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.ctx.fillStyle = 'rgba(167, 191, 255, 0.85)';
    this.stars.forEach((star) => {
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    });
  }

  private renderPlayer(): void {
    const { x, y } = this.player.position;

    this.ctx.save();
    this.ctx.translate(x, y);

    this.ctx.fillStyle = '#8fd3ff';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -this.player.height / 2);
    this.ctx.lineTo(this.player.width / 2, this.player.height / 2);
    this.ctx.lineTo(0, this.player.height / 4);
    this.ctx.lineTo(-this.player.width / 2, this.player.height / 2);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = '#4da1ff';
    this.ctx.fillRect(-4, -2, 8, 12);

    this.ctx.restore();
  }

  private renderBullets(): void {
    this.ctx.fillStyle = '#ffe699';

    this.bullets.forEach((bullet) => {
      this.ctx.beginPath();
      this.ctx.arc(bullet.position.x, bullet.position.y, bullet.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  private renderHudText(): void {
    this.ctx.fillStyle = '#d8e3ff';
    this.ctx.font = '18px Inter, sans-serif';
    this.ctx.fillText(`Shots in flight: ${this.bullets.length}`, 20, 32);
  }

  private createStarField(): Array<{ x: number; y: number; size: number }> {
    const starCount = 64;
    return Array.from({ length: starCount }, (_, index) => ({
      x: (index * 197) % GAME_WIDTH,
      y: (index * 113) % GAME_HEIGHT,
      size: index % 9 === 0 ? 2 : 1.2,
    }));
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const input = new InputState(canvas);
const game = new NebulaDefenderGame(context, input);
game.start();

window.addEventListener('beforeunload', () => {
  input.destroy();
});
