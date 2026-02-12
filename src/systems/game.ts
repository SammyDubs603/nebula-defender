import type { Boss, Bullet, Enemy, GameState, Particle, Pickup, Player, Star } from '../entities/types';
import { clamp, distance, normalize, randomRange } from '../utils/math';
import { loadHighScore, saveHighScore, type Settings } from '../utils/storage';
import { AudioSystem } from './audio';
import { InputState } from './input';

const WIDTH = 960;
const HEIGHT = 540;

const PLAYER_ACCEL = 1750;
const PLAYER_DAMPING = 0.88;
const PLAYER_MAX_SPEED = 440;
const PLAYER_FIRE_COOLDOWN = 0.11;
const PLAYER_BULLET_SPEED = 800;
const ENEMY_BULLET_SPEED = 280;

export class NebulaDefenderGame {
  private state: GameState = 'menu';

  private player: Player = this.createPlayer();

  private bullets: Bullet[] = [];

  private enemies: Enemy[] = [];

  private pickups: Pickup[] = [];

  private particles: Particle[] = [];

  private boss: Boss | null = null;

  private stars = this.createStars();

  private wave = 1;
  private waveKillTarget = 7;
  private waveKills = 0;
  private enemySpawnTimer = 1;

  private score = 0;
  private highScore = loadHighScore();
  private combo = 1;
  private comboTimer = 0;

  private fireCooldown = 0;
  private shake = 0;
  private warningTimer = 0;
  private slowmoTimer = 0;
  private pausePressed = false;

  private lastTimestamp = 0;

  private readonly audio: AudioSystem;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly input: InputState,
    private readonly overlay: HTMLDivElement,
    private settings: Settings,
  ) {
    this.audio = new AudioSystem(settings.soundEnabled);
  }

  start(): void {
    this.updateOverlay();
    requestAnimationFrame((ts) => {
      this.lastTimestamp = ts;
      requestAnimationFrame(this.tick);
    });
  }

  setState(state: GameState): void {
    this.state = state;
    this.updateOverlay();
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    this.audio.setEnabled(settings.soundEnabled);
  }

  restart(): void {
    this.player = this.createPlayer();
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.boss = null;
    this.wave = 1;
    this.waveKillTarget = 7;
    this.waveKills = 0;
    this.enemySpawnTimer = 1;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.warningTimer = 0;
    this.slowmoTimer = 0;
    this.setState('playing');
  }

  private tick = (timestamp: number): void => {
    const rawDelta = Math.min((timestamp - this.lastTimestamp) / 1000, 0.033);
    this.lastTimestamp = timestamp;
    const delta = this.slowmoTimer > 0 ? rawDelta * 0.35 : rawDelta;

    this.update(rawDelta, delta);
    this.render();

    requestAnimationFrame(this.tick);
  };

  private update(rawDelta: number, delta: number): void {
    if (this.input.isPressed('Escape') && !this.pausePressed) {
      this.pausePressed = true;
      if (this.state === 'playing') {
        this.setState('paused');
      } else if (this.state === 'paused') {
        this.setState('playing');
      }
    }
    if (!this.input.isPressed('Escape')) {
      this.pausePressed = false;
    }

    this.updateParticles(rawDelta);
    this.updateStars(rawDelta);

    if (this.state === 'warning') {
      this.warningTimer -= rawDelta;
      this.slowmoTimer -= rawDelta;
      if (this.warningTimer <= 0) {
        this.setState('playing');
      }
      return;
    }

    if (this.state !== 'playing') {
      return;
    }

    this.slowmoTimer = Math.max(0, this.slowmoTimer - rawDelta);
    this.player.hitFlash = Math.max(0, this.player.hitFlash - rawDelta * 5);
    this.comboTimer -= rawDelta;
    if (this.comboTimer <= 0) {
      this.combo = 1;
    }

    this.updatePlayer(delta);
    this.updateBullets(delta);
    this.updateEnemies(delta);
    this.updateBoss(delta);
    this.updatePickups(delta);

    this.handleCollisions();
    this.advanceWaveIfNeeded();
  }

  private updatePlayer(delta: number): void {
    const axis = this.input.movementAxis();

    this.player.velocity.x += axis.x * PLAYER_ACCEL * delta;
    this.player.velocity.y += axis.y * PLAYER_ACCEL * delta;

    this.player.velocity.x *= PLAYER_DAMPING;
    this.player.velocity.y *= PLAYER_DAMPING;

    this.player.velocity.x = clamp(this.player.velocity.x, -PLAYER_MAX_SPEED, PLAYER_MAX_SPEED);
    this.player.velocity.y = clamp(this.player.velocity.y, -PLAYER_MAX_SPEED, PLAYER_MAX_SPEED);

    this.player.position.x += this.player.velocity.x * delta;
    this.player.position.y += this.player.velocity.y * delta;

    this.player.position.x = clamp(this.player.position.x, this.player.width / 2, WIDTH - this.player.width / 2);
    this.player.position.y = clamp(this.player.position.y, this.player.height / 2, HEIGHT - this.player.height / 2);

    this.spawnThruster(delta);

    this.fireCooldown -= delta;
    if (this.input.isShooting() && this.fireCooldown <= 0) {
      this.fireCooldown = PLAYER_FIRE_COOLDOWN;
      this.bullets.push({
        position: { x: this.player.position.x, y: this.player.position.y - this.player.height / 2 },
        velocity: { x: 0, y: -PLAYER_BULLET_SPEED },
        radius: 4,
        ttl: 2,
        fromEnemy: false,
      });
      this.audio.shoot();
    }
  }

  private updateBullets(delta: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      b.position.x += b.velocity.x * delta;
      b.position.y += b.velocity.y * delta;
      b.ttl -= delta;
      if (b.ttl <= 0 || b.position.y < -20 || b.position.y > HEIGHT + 20 || b.position.x < -20 || b.position.x > WIDTH + 20) {
        this.bullets.splice(i, 1);
      }
    }
  }

  private updateEnemies(delta: number): void {
    if (this.boss?.alive) return;

    this.enemySpawnTimer -= delta;
    if (this.waveKills < this.waveKillTarget && this.enemySpawnTimer <= 0) {
      this.spawnEnemy();
      this.enemySpawnTimer = Math.max(0.25, 1.1 - this.wave * 0.05);
    }

    for (const enemy of this.enemies) {
      if (enemy.type === 'charger') {
        const dir = normalize({ x: this.player.position.x - enemy.position.x, y: this.player.position.y - enemy.position.y });
        enemy.velocity.x += dir.x * enemy.speed * 0.45 * delta;
        enemy.velocity.y += dir.y * enemy.speed * 0.45 * delta;
      } else {
        enemy.velocity.y = enemy.speed;
        enemy.velocity.x += Math.sin(enemy.position.y * 0.03) * 9;
      }

      enemy.position.x += enemy.velocity.x * delta;
      enemy.position.y += enemy.velocity.y * delta;
      enemy.fireCooldown -= delta;

      if (enemy.fireCooldown <= 0 && enemy.type === 'drone' && this.wave >= 2) {
        enemy.fireCooldown = randomRange(1.2, 2.4);
        const dir = normalize({ x: this.player.position.x - enemy.position.x, y: this.player.position.y - enemy.position.y });
        this.bullets.push({
          position: { ...enemy.position },
          velocity: { x: dir.x * ENEMY_BULLET_SPEED, y: dir.y * ENEMY_BULLET_SPEED },
          radius: 4,
          ttl: 3,
          fromEnemy: true,
        });
      }
    }

    this.enemies = this.enemies.filter((enemy) => enemy.position.y < HEIGHT + 50 && enemy.hp > 0);
  }

  private updateBoss(delta: number): void {
    if (!this.boss?.alive) return;
    const boss = this.boss;
    boss.patternTimer += delta;
    boss.fireCooldown -= delta;

    const ratio = boss.hp / boss.maxHp;
    boss.phase = ratio <= 0.3 ? 3 : ratio <= 0.7 ? 2 : 1;

    boss.velocity.x = Math.sin(boss.patternTimer * 0.9) * (boss.phase === 3 ? 180 : 120);
    boss.position.x += boss.velocity.x * delta;
    boss.position.x = clamp(boss.position.x, boss.radius + 20, WIDTH - boss.radius - 20);

    if (boss.fireCooldown <= 0) {
      this.fireBossPattern(boss);
      boss.fireCooldown = boss.phase === 1 ? 1.1 : boss.phase === 2 ? 0.8 : 0.55;
    }

    if (boss.hp <= 0) {
      boss.alive = false;
      this.score += 2500 * this.combo;
      this.combo += 1;
      this.comboTimer = 3;
      this.audio.explosion();
      this.explodeAt(boss.position.x, boss.position.y, '#ff7f4d', 90);
    }
  }

  private updatePickups(delta: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      pickup.position.y += pickup.velocityY * delta;
      if (pickup.position.y > HEIGHT + 30) {
        this.pickups.splice(i, 1);
      }
    }
  }

  private handleCollisions(): void {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bullets[i];
      if (!bullet.fromEnemy) {
        let consumed = false;
        for (let e = this.enemies.length - 1; e >= 0; e -= 1) {
          const enemy = this.enemies[e];
          if (distance(bullet.position, enemy.position) < bullet.radius + enemy.radius) {
            this.bullets.splice(i, 1);
            enemy.hp -= 1;
            this.explodeAt(bullet.position.x, bullet.position.y, '#ffd37b', 8);
            consumed = true;
            if (enemy.hp <= 0) {
              this.enemyKilled(enemy, e);
            }
            break;
          }
        }

        if (!consumed && this.boss?.alive && distance(bullet.position, this.boss.position) < bullet.radius + this.boss.radius) {
          this.bullets.splice(i, 1);
          this.boss.hp -= 1;
          this.score += 6;
          this.explodeAt(bullet.position.x, bullet.position.y, '#ffb366', 6);
        }
      } else if (distance(bullet.position, this.player.position) < bullet.radius + 16) {
        this.bullets.splice(i, 1);
        this.damagePlayer(11);
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (distance(enemy.position, this.player.position) < enemy.radius + 18) {
        this.enemies.splice(i, 1);
        this.damagePlayer(18);
        this.explodeAt(enemy.position.x, enemy.position.y, '#ff6a4d', 18);
      }
    }

    if (this.boss?.alive && distance(this.boss.position, this.player.position) < this.boss.radius + 18) {
      this.damagePlayer(28);
    }

    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      if (distance(pickup.position, this.player.position) < pickup.radius + 18) {
        if (pickup.type === 'health') {
          this.player.hp = clamp(this.player.hp + 25, 0, 100);
        } else {
          this.player.shield = clamp(this.player.shield + 30, 0, 100);
        }
        this.pickups.splice(i, 1);
        this.audio.pickup();
      }
    }
  }

  private enemyKilled(enemy: Enemy, enemyIndex: number): void {
    this.enemies.splice(enemyIndex, 1);
    this.waveKills += 1;
    this.combo = Math.min(this.combo + 0.2, 8);
    this.comboTimer = 2.5;
    this.score += Math.floor((enemy.type === 'charger' ? 180 : 120) * this.combo);
    this.audio.explosion();
    this.explodeAt(enemy.position.x, enemy.position.y, '#ff9a62', 26);

    if (Math.random() < 0.13) {
      this.pickups.push({
        position: { ...enemy.position },
        radius: 9,
        velocityY: 120,
        type: Math.random() < 0.5 ? 'health' : 'shield',
      });
    }
  }

  private damagePlayer(amount: number): void {
    const absorbed = Math.min(this.player.shield, amount);
    this.player.shield -= absorbed;
    this.player.hp -= amount - absorbed;
    this.player.hitFlash = 1;
    this.shake = Math.min(18, this.shake + 7);
    this.audio.hit();

    if (this.player.hp <= 0) {
      this.state = 'gameOver';
      if (this.score > this.highScore) {
        this.highScore = this.score;
        saveHighScore(this.highScore);
      }
      this.updateOverlay();
    }
  }

  private advanceWaveIfNeeded(): void {
    if (this.boss?.alive) return;

    if (this.waveKills >= this.waveKillTarget && this.enemies.length === 0) {
      this.wave += 1;
      this.waveKills = 0;
      this.waveKillTarget = Math.min(22, this.waveKillTarget + 2);
      this.enemySpawnTimer = 1;

      if (this.wave % 5 === 0) {
        this.spawnBossWarning();
      }
    }
  }

  private spawnBossWarning(): void {
    this.setState('warning');
    this.warningTimer = 2.2;
    this.slowmoTimer = 2.2;
    this.audio.warning();
    this.boss = {
      position: { x: WIDTH / 2, y: 100 },
      velocity: { x: 0, y: 0 },
      radius: 45,
      hp: 180 + this.wave * 22,
      maxHp: 180 + this.wave * 22,
      fireCooldown: 1,
      patternTimer: 0,
      phase: 1,
      alive: true,
    };
  }

  private fireBossPattern(boss: Boss): void {
    if (boss.phase === 1) {
      for (let i = -2; i <= 2; i += 1) {
        this.bullets.push({
          position: { x: boss.position.x + i * 16, y: boss.position.y + 30 },
          velocity: { x: i * 35, y: ENEMY_BULLET_SPEED },
          radius: 5,
          ttl: 4,
          fromEnemy: true,
        });
      }
    } else if (boss.phase === 2) {
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12;
        this.bullets.push({
          position: { ...boss.position },
          velocity: { x: Math.cos(angle) * 170, y: Math.sin(angle) * 170 + 80 },
          radius: 4,
          ttl: 4,
          fromEnemy: true,
        });
      }
    } else {
      const dir = normalize({ x: this.player.position.x - boss.position.x, y: this.player.position.y - boss.position.y });
      for (let i = -3; i <= 3; i += 1) {
        const side = { x: dir.x * ENEMY_BULLET_SPEED + i * 30, y: dir.y * ENEMY_BULLET_SPEED + Math.abs(i) * 8 };
        this.bullets.push({
          position: { ...boss.position },
          velocity: side,
          radius: 5,
          ttl: 3,
          fromEnemy: true,
        });
      }
    }
  }

  private spawnEnemy(): void {
    const chargerChance = Math.min(0.4, 0.08 + this.wave * 0.03);
    const type = Math.random() < chargerChance ? 'charger' : 'drone';
    this.enemies.push({
      position: { x: randomRange(30, WIDTH - 30), y: -20 },
      velocity: { x: 0, y: 0 },
      radius: type === 'charger' ? 15 : 13,
      hp: type === 'charger' ? 3 + Math.floor(this.wave / 5) : 2 + Math.floor(this.wave / 6),
      speed: type === 'charger' ? 140 + this.wave * 3 : 70 + this.wave * 4,
      fireCooldown: randomRange(0.7, 1.7),
      type,
    });
  }

  private explodeAt(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const speed = randomRange(30, 240);
      this.particles.push({
        position: { x, y },
        velocity: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
        life: randomRange(0.15, 0.8),
        maxLife: 0.8,
        color,
        size: randomRange(1, 3.4),
      });
    }
  }

  private spawnThruster(delta: number): void {
    if (Math.abs(this.player.velocity.x) + Math.abs(this.player.velocity.y) < 20) return;
    if (Math.random() > delta * 45) return;
    this.particles.push({
      position: { x: this.player.position.x, y: this.player.position.y + this.player.height * 0.4 },
      velocity: { x: randomRange(-16, 16), y: randomRange(90, 170) },
      life: randomRange(0.1, 0.26),
      maxLife: 0.26,
      color: '#5bd1ff',
      size: randomRange(1, 2.2),
    });
  }

  private updateParticles(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= delta;
      p.position.x += p.velocity.x * delta;
      p.position.y += p.velocity.y * delta;
      p.velocity.x *= 0.97;
      p.velocity.y *= 0.97;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateStars(delta: number): void {
    for (const star of this.stars) {
      star.y += star.speed * delta;
      if (star.y > HEIGHT) {
        star.y = -2;
        star.x = randomRange(0, WIDTH);
      }
    }
  }

  private render(): void {
    this.ctx.save();
    if (this.shake > 0 && this.settings.screenshake) {
      this.ctx.translate(randomRange(-this.shake, this.shake), randomRange(-this.shake, this.shake));
      this.shake *= 0.85;
    }

    this.ctx.fillStyle = '#020615';
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.renderStars();
    this.renderParticles();
    this.renderPickups();
    this.renderBullets();
    this.renderEnemies();
    this.renderBoss();
    this.renderPlayer();
    this.renderHud();
    if (this.state === 'warning') {
      this.renderWarningBanner();
    }

    this.ctx.restore();
  }

  private renderStars(): void {
    for (const star of this.stars) {
      const alpha = star.layer === 3 ? 0.9 : star.layer === 2 ? 0.65 : 0.4;
      this.ctx.fillStyle = `rgba(190,210,255,${alpha})`;
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  private renderPlayer(): void {
    const { x, y } = this.player.position;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.fillStyle = this.player.hitFlash > 0 ? '#ffffff' : '#8fd3ff';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -14);
    this.ctx.lineTo(22, 12);
    this.ctx.lineTo(0, 5);
    this.ctx.lineTo(-22, 12);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillStyle = '#4ca4ff';
    this.ctx.fillRect(-4, -2, 8, 12);
    this.ctx.restore();
  }

  private renderBullets(): void {
    for (const bullet of this.bullets) {
      this.ctx.fillStyle = bullet.fromEnemy ? '#ff8d75' : '#ffe28a';
      this.ctx.beginPath();
      this.ctx.arc(bullet.position.x, bullet.position.y, bullet.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private renderEnemies(): void {
    for (const enemy of this.enemies) {
      this.ctx.fillStyle = enemy.type === 'charger' ? '#ff8d7c' : '#ffba7b';
      this.ctx.beginPath();
      this.ctx.arc(enemy.position.x, enemy.position.y, enemy.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private renderBoss(): void {
    if (!this.boss?.alive) return;
    const boss = this.boss;
    this.ctx.fillStyle = boss.phase === 3 ? '#ff4f8b' : boss.phase === 2 ? '#ff8d48' : '#ffb35a';
    this.ctx.beginPath();
    this.ctx.arc(boss.position.x, boss.position.y, boss.radius, 0, Math.PI * 2);
    this.ctx.fill();

    const barWidth = 360;
    const ratio = boss.hp / boss.maxHp;
    this.ctx.fillStyle = 'rgba(24,30,55,0.8)';
    this.ctx.fillRect(WIDTH / 2 - barWidth / 2, 18, barWidth, 14);
    this.ctx.fillStyle = '#ff6f68';
    this.ctx.fillRect(WIDTH / 2 - barWidth / 2, 18, barWidth * ratio, 14);
    this.ctx.strokeStyle = '#ffffff66';
    this.ctx.strokeRect(WIDTH / 2 - barWidth / 2, 18, barWidth, 14);
  }

  private renderPickups(): void {
    for (const pickup of this.pickups) {
      this.ctx.fillStyle = pickup.type === 'health' ? '#7dff9f' : '#75d4ff';
      this.ctx.beginPath();
      this.ctx.arc(pickup.position.x, pickup.position.y, pickup.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private renderParticles(): void {
    for (const p of this.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      this.ctx.fillStyle = `${p.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      this.ctx.fillRect(p.position.x, p.position.y, p.size, p.size);
    }
  }

  private renderHud(): void {
    this.ctx.fillStyle = '#e6ecff';
    this.ctx.font = '16px Inter, sans-serif';
    this.ctx.fillText(`Wave ${this.wave}`, 16, 28);
    this.ctx.fillText(`Score ${this.score}`, 16, 50);
    this.ctx.fillText(`High ${this.highScore}`, 16, 72);
    this.ctx.fillText(`Combo x${this.combo.toFixed(1)}`, 16, 94);
    this.ctx.fillText(`HP ${Math.max(0, Math.floor(this.player.hp))}`, WIDTH - 140, 28);
    this.ctx.fillText(`Shield ${Math.max(0, Math.floor(this.player.shield))}`, WIDTH - 140, 50);
  }

  private renderWarningBanner(): void {
    this.ctx.fillStyle = 'rgba(255,40,40,0.23)';
    this.ctx.fillRect(0, HEIGHT / 2 - 42, WIDTH, 84);
    this.ctx.fillStyle = '#ffe9e7';
    this.ctx.font = 'bold 48px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('WARNING — BOSS INCOMING', WIDTH / 2, HEIGHT / 2 + 16);
    this.ctx.textAlign = 'start';
  }

  private updateOverlay(): void {
    if (this.state === 'menu') {
      this.overlay.innerHTML = `<h2>Nebula Defender — Phase 2</h2><p>Fight through waves, build combos, survive bosses.</p><button data-action="start">Start Game</button><button data-action="settings">Settings</button>`;
    } else if (this.state === 'settings') {
      this.overlay.innerHTML = `<h2>Settings</h2><label><input type="checkbox" data-setting="sound" ${this.settings.soundEnabled ? 'checked' : ''}/> Sound</label><label><input type="checkbox" data-setting="shake" ${this.settings.screenshake ? 'checked' : ''}/> Screen shake</label><button data-action="back">Back</button>`;
    } else if (this.state === 'paused') {
      this.overlay.innerHTML = `<h2>Paused</h2><button data-action="resume">Resume</button><button data-action="menu">Main Menu</button>`;
    } else if (this.state === 'gameOver') {
      this.overlay.innerHTML = `<h2>Game Over</h2><p>Score: ${this.score}</p><p>High Score: ${this.highScore}</p><button data-action="restart">Restart</button><button data-action="menu">Main Menu</button>`;
    } else {
      this.overlay.innerHTML = '';
    }
  }

  private createPlayer(): Player {
    return {
      position: { x: WIDTH / 2, y: HEIGHT - 80 },
      velocity: { x: 0, y: 0 },
      width: 42,
      height: 28,
      hp: 100,
      shield: 45,
      hitFlash: 0,
    };
  }

  private createStars(): Star[] {
    const stars: Star[] = [];
    for (let i = 0; i < 110; i += 1) {
      const layer = i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1;
      stars.push({
        x: randomRange(0, WIDTH),
        y: randomRange(0, HEIGHT),
        size: layer === 3 ? 2 : layer === 2 ? 1.5 : 1,
        speed: layer * 30,
        layer,
      });
    }
    return stars;
  }
}
