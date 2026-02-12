import { ENEMY_SPECS } from '../entities/enemyDefs';
import type {
  Boss,
  Bullet,
  DamageNumber,
  Enemy,
  EnemySpec,
  EnemyType,
  GameState,
  Particle,
  Pickup,
  Player,
  RunUpgrades,
  Star,
  UpgradeDefinition,
} from '../entities/types';
import { UPGRADE_LABELS, UPGRADE_POOL, createUpgradeState } from '../ui/upgrades';
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
  private runUpgrades: RunUpgrades = createUpgradeState();
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private damageNumbers: DamageNumber[] = [];
  private boss: Boss | null = null;
  private stars = this.createStars();

  private wave = 1;
  private waveKillTarget = 7;
  private waveKills = 0;
  private enemySpawnTimer = 1;
  private waveBudget = 0;
  private waveBudgetRemaining = 0;
  private nextUpgradeOptions: UpgradeDefinition[] = [];
  private comboPulse = 0;

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
    this.runUpgrades = createUpgradeState();
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.damageNumbers = [];
    this.boss = null;
    this.wave = 1;
    this.waveKillTarget = 7;
    this.waveKills = 0;
    this.waveBudget = this.computeWaveBudget(this.wave);
    this.waveBudgetRemaining = this.waveBudget;
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
      if (this.state === 'playing') this.setState('paused');
      else if (this.state === 'paused') this.setState('playing');
    }
    if (!this.input.isPressed('Escape')) this.pausePressed = false;

    this.updateParticles(rawDelta);
    this.updateStars(rawDelta);
    this.updateDamageNumbers(rawDelta);

    if (this.state === 'upgrade') {
      this.handleUpgradeInput();
      return;
    }

    if (this.state === 'warning') {
      this.warningTimer -= rawDelta;
      this.slowmoTimer -= rawDelta;
      if (this.warningTimer <= 0) this.setState('playing');
      return;
    }

    if (this.state !== 'playing') return;

    this.comboPulse = Math.max(0, this.comboPulse - rawDelta * 3);
    this.slowmoTimer = Math.max(0, this.slowmoTimer - rawDelta);
    this.player.hitFlash = Math.max(0, this.player.hitFlash - rawDelta * 5);
    this.player.invulnTimer = Math.max(0, this.player.invulnTimer - rawDelta);
    this.player.dashCooldown = Math.max(0, this.player.dashCooldown - rawDelta);
    this.comboTimer -= rawDelta;
    if (this.comboTimer <= 0) this.combo = 1;

    const regenRate = 4 * (1 + this.runUpgrades.shieldRegen * 0.15);
    this.player.shield = Math.min(this.player.maxShield, this.player.shield + regenRate * rawDelta);

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
    const moveSpeedMult = 1 + this.runUpgrades.moveSpeed * 0.12;

    this.player.velocity.x += axis.x * PLAYER_ACCEL * moveSpeedMult * delta;
    this.player.velocity.y += axis.y * PLAYER_ACCEL * moveSpeedMult * delta;
    this.player.velocity.x *= PLAYER_DAMPING;
    this.player.velocity.y *= PLAYER_DAMPING;

    const maxSpeed = PLAYER_MAX_SPEED * moveSpeedMult;
    this.player.velocity.x = clamp(this.player.velocity.x, -maxSpeed, maxSpeed);
    this.player.velocity.y = clamp(this.player.velocity.y, -maxSpeed, maxSpeed);

    if (this.runUpgrades.dash > 0 && this.input.isPressed('ShiftLeft') && this.player.dashCooldown <= 0) {
      const dir = normalize(axis.x !== 0 || axis.y !== 0 ? axis : { x: 0, y: -1 });
      this.player.velocity.x += dir.x * 620;
      this.player.velocity.y += dir.y * 620;
      this.player.invulnTimer = 0.25;
      this.player.dashCooldown = 1.6;
      this.explodeAt(this.player.position.x, this.player.position.y, '#90d9ff', 14);
    }

    this.player.position.x = clamp(this.player.position.x + this.player.velocity.x * delta, this.player.width / 2, WIDTH - this.player.width / 2);
    this.player.position.y = clamp(this.player.position.y + this.player.velocity.y * delta, this.player.height / 2, HEIGHT - this.player.height / 2);

    this.spawnThruster(delta);

    this.fireCooldown -= delta;
    if (this.input.isShooting() && this.fireCooldown <= 0) {
      const rate = 1 + this.runUpgrades.fireRate * 0.15;
      this.fireCooldown = PLAYER_FIRE_COOLDOWN / rate;
      const count = 1 + this.runUpgrades.extraProjectile;
      for (let i = 0; i < count; i += 1) {
        const offset = count === 1 ? 0 : ((i / (count - 1)) - 0.5) * 0.34;
        this.spawnPlayerBullet(offset);
      }
      this.audio.shoot();
    }
  }

  private spawnPlayerBullet(angleOffset: number): void {
    const speed = PLAYER_BULLET_SPEED * (1 + this.runUpgrades.projectileSpeed * 0.25);
    this.bullets.push({
      position: { x: this.player.position.x, y: this.player.position.y - this.player.height / 2 },
      velocity: { x: Math.sin(angleOffset) * speed, y: -Math.cos(angleOffset) * speed },
      radius: 4,
      ttl: 2,
      fromEnemy: false,
      damage: 1 * (1 + this.runUpgrades.damage * 0.2),
      pierce: this.runUpgrades.pierce,
      crit: false,
    });
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
    if (this.waveKills < this.waveKillTarget && this.waveBudgetRemaining > 0 && this.enemySpawnTimer <= 0) {
      this.spawnEnemy();
      this.enemySpawnTimer = Math.max(0.2, 0.95 - this.wave * 0.03);
    }

    for (const enemy of this.enemies) {
      enemy.age += delta;
      enemy.aiTimer -= delta;
      switch (enemy.type) {
        case 'drifter':
        case 'tank':
        case 'splitter':
          enemy.velocity.y = enemy.speed;
          break;
        case 'zigzagger':
          enemy.velocity.x = Math.sin(enemy.age * 5 + enemy.zigPhase) * 120;
          enemy.velocity.y = enemy.speed;
          break;
        case 'dasher': {
          if (enemy.aiTimer <= 0) {
            const dir = normalize({ x: this.player.position.x - enemy.position.x, y: this.player.position.y - enemy.position.y });
            enemy.velocity.x = dir.x * enemy.speed * 3;
            enemy.velocity.y = dir.y * enemy.speed * 3;
            enemy.aiTimer = 1.2;
            enemy.dashWindow = 0.25;
          } else if (enemy.dashWindow <= 0) {
            enemy.velocity.x *= 0.94;
            enemy.velocity.y = Math.max(enemy.velocity.y, enemy.speed * 0.45);
          }
          enemy.dashWindow -= delta;
          break;
        }
        case 'shooter':
          enemy.velocity.y = enemy.position.y < 150 ? enemy.speed : 10;
          if (enemy.fireCooldown <= 0) {
            enemy.fireCooldown = randomRange(1.05, 1.9);
            const dir = normalize({ x: this.player.position.x - enemy.position.x, y: this.player.position.y - enemy.position.y });
            this.bullets.push({
              position: { ...enemy.position },
              velocity: { x: dir.x * ENEMY_BULLET_SPEED, y: dir.y * ENEMY_BULLET_SPEED },
              radius: 4,
              ttl: 3,
              fromEnemy: true,
              damage: 12,
              pierce: 0,
              crit: false,
            });
          }
          enemy.fireCooldown -= delta;
          break;
        case 'splitDrone':
          enemy.velocity.y = enemy.speed;
          enemy.velocity.x *= 0.98;
          break;
      }

      enemy.position.x += enemy.velocity.x * delta;
      enemy.position.y += enemy.velocity.y * delta;
    }

    this.enemies = this.enemies.filter((enemy) => enemy.position.y < HEIGHT + 60 && enemy.hp > 0);
  }

  private updateBoss(delta: number): void {
    if (!this.boss?.alive) return;
    const boss = this.boss;
    boss.patternTimer += delta;
    boss.fireCooldown -= delta;

    const ratio = boss.hp / boss.maxHp;
    boss.phase = ratio <= 0.3 ? 3 : ratio <= 0.7 ? 2 : 1;
    boss.velocity.x = Math.sin(boss.patternTimer * 0.9) * (boss.phase === 3 ? 180 : 120);
    boss.position.x = clamp(boss.position.x + boss.velocity.x * delta, boss.radius + 20, WIDTH - boss.radius - 20);

    if (boss.fireCooldown <= 0) {
      this.fireBossPattern(boss);
      boss.fireCooldown = boss.phase === 1 ? 1.1 : boss.phase === 2 ? 0.8 : 0.55;
    }

    if (boss.hp <= 0) {
      boss.alive = false;
      this.score += Math.floor(2500 * this.combo);
      this.bumpCombo(1);
      this.audio.explosion();
      this.explodeAt(boss.position.x, boss.position.y, '#ff7f4d', 90);
    }
  }

  private updatePickups(delta: number): void {
    const magnet = this.player.pickupMagnetRadius * (1 + this.runUpgrades.magnet * 0.25);
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      const d = distance(pickup.position, this.player.position);
      if (d < magnet) {
        const dir = normalize({ x: this.player.position.x - pickup.position.x, y: this.player.position.y - pickup.position.y });
        pickup.position.x += dir.x * 280 * delta;
        pickup.position.y += dir.y * 280 * delta;
      } else {
        pickup.position.y += pickup.velocityY * delta;
      }

      if (pickup.position.y > HEIGHT + 30) this.pickups.splice(i, 1);
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
            const crit = Math.random() < this.runUpgrades.critChance * 0.1;
            const damage = bullet.damage * (crit ? 2 : 1);
            enemy.hp -= damage;
            this.spawnDamageNumber(enemy.position.x, enemy.position.y - 10, damage, crit);
            this.explodeAt(bullet.position.x, bullet.position.y, crit ? '#ffe188' : '#ffd37b', crit ? 12 : 7);

            if (bullet.pierce <= 0) {
              this.bullets.splice(i, 1);
              consumed = true;
            } else {
              bullet.pierce -= 1;
            }

            if (enemy.hp <= 0) this.enemyKilled(enemy, e);
            break;
          }
        }

        if (!consumed && this.boss?.alive && distance(bullet.position, this.boss.position) < bullet.radius + this.boss.radius) {
          this.bullets.splice(i, 1);
          const crit = Math.random() < this.runUpgrades.critChance * 0.1;
          const damage = bullet.damage * (crit ? 2 : 1);
          this.boss.hp -= damage;
          this.score += Math.floor(6 * (crit ? 2 : 1));
          this.spawnDamageNumber(bullet.position.x, bullet.position.y, damage, crit);
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

    if (this.boss?.alive && distance(this.boss.position, this.player.position) < this.boss.radius + 18) this.damagePlayer(28);

    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      if (distance(pickup.position, this.player.position) < pickup.radius + 18) {
        if (pickup.type === 'health') this.player.hp = clamp(this.player.hp + 25, 0, this.player.maxHp);
        else this.player.shield = clamp(this.player.shield + 30, 0, this.player.maxShield);
        this.pickups.splice(i, 1);
        this.audio.pickup();
      }
    }
  }

  private enemyKilled(enemy: Enemy, enemyIndex: number): void {
    this.enemies.splice(enemyIndex, 1);
    this.waveKills += 1;
    this.bumpCombo(0.2);
    this.score += Math.floor(enemy.scoreValue * this.combo * (enemy.elite ? 1.25 : 1));
    this.audio.explosion();
    this.explodeAt(enemy.position.x, enemy.position.y, enemy.elite ? '#ffeaa1' : '#ff9a62', enemy.elite ? 36 : 26);

    if (enemy.type === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        this.enemies.push(this.createEnemy({ type: 'splitDrone', unlockWave: 1, cost: 0, hp: 1, speed: 170, radius: 9, scoreValue: 70 }, false, enemy.position, i === 0 ? -120 : 120));
      }
    }

    const shouldDrop = enemy.elite || Math.random() < 0.13;
    if (shouldDrop) {
      this.pickups.push({
        position: { ...enemy.position },
        radius: 9,
        velocityY: 120,
        type: Math.random() < 0.5 ? 'health' : 'shield',
      });
    }
  }

  private bumpCombo(delta: number): void {
    const prev = this.combo;
    this.combo = Math.min(this.combo + delta, 8);
    this.comboTimer = 2.5;
    if (this.combo > prev) this.comboPulse = 1;
  }

  private damagePlayer(amount: number): void {
    if (this.player.invulnTimer > 0) return;
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
      this.waveKillTarget = Math.min(28, this.waveKillTarget + 2);
      this.waveBudget = this.computeWaveBudget(this.wave);
      this.waveBudgetRemaining = this.waveBudget;
      this.enemySpawnTimer = 0.7;

      if (this.wave % 5 === 0) this.spawnBossWarning();
      else this.enterUpgradeState();
    }
  }

  private enterUpgradeState(): void {
    this.state = 'upgrade';
    this.nextUpgradeOptions = this.rollUpgradeOptions();
    this.updateOverlay();
  }

  private rollUpgradeOptions(): UpgradeDefinition[] {
    const pool = [...UPGRADE_POOL];
    const picks: UpgradeDefinition[] = [];
    while (picks.length < 3 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }
    return picks;
  }

  chooseUpgrade(slot: number): void {
    const picked = this.nextUpgradeOptions[slot];
    if (!picked) return;
    this.runUpgrades[picked.id] += 1;

    if (picked.id === 'maxHp') {
      this.player.maxHp += 20;
      this.player.hp += 20;
    } else if (picked.id === 'maxShield') {
      this.player.maxShield += 20;
      this.player.shield += 20;
    }

    this.setState('playing');
  }

  private handleUpgradeInput(): void {
    if (this.input.isPressed('Digit1')) this.chooseUpgrade(0);
    else if (this.input.isPressed('Digit2')) this.chooseUpgrade(1);
    else if (this.input.isPressed('Digit3')) this.chooseUpgrade(2);
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
        this.bullets.push({ position: { x: boss.position.x + i * 16, y: boss.position.y + 30 }, velocity: { x: i * 35, y: ENEMY_BULLET_SPEED }, radius: 5, ttl: 4, fromEnemy: true, damage: 12, pierce: 0, crit: false });
      }
    } else if (boss.phase === 2) {
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12;
        this.bullets.push({ position: { ...boss.position }, velocity: { x: Math.cos(angle) * 170, y: Math.sin(angle) * 170 + 80 }, radius: 4, ttl: 4, fromEnemy: true, damage: 12, pierce: 0, crit: false });
      }
    } else {
      const dir = normalize({ x: this.player.position.x - boss.position.x, y: this.player.position.y - boss.position.y });
      for (let i = -3; i <= 3; i += 1) {
        this.bullets.push({ position: { ...boss.position }, velocity: { x: dir.x * ENEMY_BULLET_SPEED + i * 30, y: dir.y * ENEMY_BULLET_SPEED + Math.abs(i) * 8 }, radius: 5, ttl: 3, fromEnemy: true, damage: 14, pierce: 0, crit: false });
      }
    }
  }

  private computeWaveBudget(wave: number): number {
    return 7 + Math.floor(wave * 1.75);
  }

  private spawnEnemy(): void {
    const unlocked = ENEMY_SPECS.filter((spec) => spec.unlockWave <= this.wave && spec.cost <= this.waveBudgetRemaining);
    if (unlocked.length === 0) return;
    const spec = unlocked[Math.floor(Math.random() * unlocked.length)];
    this.waveBudgetRemaining -= spec.cost;
    const elite = this.wave >= 4 && Math.random() < Math.min(0.28, 0.03 + this.wave * 0.015);
    this.enemies.push(this.createEnemy(spec, elite));
  }

  private createEnemy(spec: EnemySpec, elite: boolean, at?: { x: number; y: number }, impulseX = 0): Enemy {
    const hp = spec.hp + Math.floor(this.wave * 0.25);
    const enemy: Enemy = {
      position: at ? { ...at } : { x: randomRange(40, WIDTH - 40), y: -30 },
      velocity: { x: impulseX, y: 0 },
      radius: spec.radius * (elite ? 1.15 : 1),
      hp: hp * (elite ? 1.5 : 1),
      maxHp: hp * (elite ? 1.5 : 1),
      speed: (spec.speed + this.wave * 2.5) * (elite ? 1.2 : 1),
      fireCooldown: randomRange(0.8, 1.6),
      type: spec.type,
      scoreValue: spec.scoreValue,
      elite,
      age: 0,
      aiTimer: randomRange(0.5, 1.2),
      dashWindow: 0,
      zigPhase: Math.random() * Math.PI * 2,
    };
    return enemy;
  }

  private spawnDamageNumber(x: number, y: number, value: number, crit: boolean): void {
    this.damageNumbers.push({ position: { x, y }, velocity: { x: randomRange(-15, 15), y: crit ? -78 : -64 }, value: Math.max(1, Math.round(value)), crit, life: 0.65, maxLife: 0.65 });
  }

  private explodeAt(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const speed = randomRange(30, 240);
      this.particles.push({ position: { x, y }, velocity: { x: Math.cos(a) * speed, y: Math.sin(a) * speed }, life: randomRange(0.15, 0.8), maxLife: 0.8, color, size: randomRange(1, 3.4) });
    }
  }

  private spawnThruster(delta: number): void {
    if (Math.abs(this.player.velocity.x) + Math.abs(this.player.velocity.y) < 20) return;
    if (Math.random() > delta * 45) return;
    this.particles.push({ position: { x: this.player.position.x, y: this.player.position.y + this.player.height * 0.4 }, velocity: { x: randomRange(-16, 16), y: randomRange(90, 170) }, life: randomRange(0.1, 0.26), maxLife: 0.26, color: '#5bd1ff', size: randomRange(1, 2.2) });
  }

  private updateParticles(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= delta;
      p.position.x += p.velocity.x * delta;
      p.position.y += p.velocity.y * delta;
      p.velocity.x *= 0.97;
      p.velocity.y *= 0.97;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private updateDamageNumbers(delta: number): void {
    for (let i = this.damageNumbers.length - 1; i >= 0; i -= 1) {
      const num = this.damageNumbers[i];
      num.life -= delta;
      num.position.x += num.velocity.x * delta;
      num.position.y += num.velocity.y * delta;
      if (num.life <= 0) this.damageNumbers.splice(i, 1);
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
    this.renderDamageNumbers();
    this.renderHud();

    if (this.state === 'warning') this.renderWarningBanner();
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

    if (this.combo >= 3) {
      this.ctx.strokeStyle = `rgba(123,210,255,${0.35 + Math.sin(performance.now() * 0.01) * 0.12})`;
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 24 + Math.sin(performance.now() * 0.018) * 2, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.fillStyle = this.player.invulnTimer > 0 ? '#d9f4ff' : this.player.hitFlash > 0 ? '#ffffff' : '#8fd3ff';
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
      this.ctx.fillStyle = this.getEnemyColor(enemy.type);
      this.ctx.beginPath();
      this.ctx.arc(enemy.position.x, enemy.position.y, enemy.radius, 0, Math.PI * 2);
      this.ctx.fill();

      if (enemy.elite) {
        this.ctx.strokeStyle = '#ffe38e';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    }
  }

  private getEnemyColor(type: EnemyType): string {
    switch (type) {
      case 'drifter': return '#ffba7b';
      case 'zigzagger': return '#ff8f95';
      case 'tank': return '#c383ff';
      case 'dasher': return '#ff6f61';
      case 'shooter': return '#ffbf5f';
      case 'splitter': return '#7cd8ff';
      case 'splitDrone': return '#89f1c0';
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

  private renderDamageNumbers(): void {
    for (const num of this.damageNumbers) {
      const alpha = clamp(num.life / num.maxLife, 0, 1);
      this.ctx.fillStyle = num.crit ? `rgba(255,228,140,${alpha})` : `rgba(235,240,255,${alpha})`;
      this.ctx.font = `${num.crit ? 'bold 20px' : '16px'} Inter, sans-serif`;
      this.ctx.fillText(`${num.value}${num.crit ? '!' : ''}`, num.position.x, num.position.y);
    }
  }

  private renderHud(): void {
    this.ctx.fillStyle = '#e6ecff';
    this.ctx.font = '16px Inter, sans-serif';
    this.ctx.fillText(`Wave ${this.wave}`, 16, 28);
    this.ctx.fillText(`Score ${this.score}`, 16, 50);
    this.ctx.fillText(`High ${this.highScore}`, 16, 72);

    const pulse = 1 + this.comboPulse * 0.15;
    this.ctx.save();
    this.ctx.translate(16, 98);
    this.ctx.scale(pulse, pulse);
    this.ctx.fillStyle = this.combo >= 3 ? '#9ad9ff' : '#e6ecff';
    this.ctx.fillText(`Combo x${this.combo.toFixed(1)}`, 0, 0);
    this.ctx.restore();

    this.ctx.fillStyle = '#e6ecff';
    this.ctx.fillText(`HP ${Math.max(0, Math.floor(this.player.hp))}/${Math.floor(this.player.maxHp)}`, WIDTH - 195, 28);
    this.ctx.fillText(`Shield ${Math.max(0, Math.floor(this.player.shield))}/${Math.floor(this.player.maxShield)}`, WIDTH - 195, 50);

    const active = Object.entries(this.runUpgrades).filter(([, count]) => count > 0).slice(0, 6);
    this.ctx.fillStyle = 'rgba(9,20,45,0.8)';
    this.ctx.fillRect(WIDTH - 238, 72, 222, 20 + active.length * 18);
    this.ctx.strokeStyle = '#7aa8ff55';
    this.ctx.strokeRect(WIDTH - 238, 72, 222, 20 + active.length * 18);
    this.ctx.fillStyle = '#cde1ff';
    this.ctx.fillText('Run Build', WIDTH - 225, 90);
    active.forEach(([key, count], index) => this.ctx.fillText(`${UPGRADE_LABELS[key as keyof RunUpgrades]} x${count}`, WIDTH - 225, 108 + index * 18));
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
      this.overlay.innerHTML = `<h2>Nebula Defender — Phase 3</h2><p>Roguelike builds, enemy variants, elite threats.</p><button data-action="start">Start Game</button><button data-action="settings">Settings</button>`;
    } else if (this.state === 'settings') {
      this.overlay.innerHTML = `<h2>Settings</h2><label><input type="checkbox" data-setting="sound" ${this.settings.soundEnabled ? 'checked' : ''}/> Sound</label><label><input type="checkbox" data-setting="shake" ${this.settings.screenshake ? 'checked' : ''}/> Screen shake</label><button data-action="back">Back</button>`;
    } else if (this.state === 'paused') {
      this.overlay.innerHTML = `<h2>Paused</h2><button data-action="resume">Resume</button><button data-action="menu">Main Menu</button>`;
    } else if (this.state === 'upgrade') {
      this.overlay.innerHTML = `<h2>CHOOSE AN UPGRADE</h2><p>Press 1 / 2 / 3 or click a card.</p><div class="upgrade-grid">${this.nextUpgradeOptions
        .map(
          (upgrade, index) => `<button class="upgrade-card" data-upgrade-index="${index}"><span class="upgrade-card__icon">${upgrade.icon}</span><strong>${index + 1}. ${upgrade.name}</strong><small>${upgrade.description}</small></button>`,
        )
        .join('')}</div>`;
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
      maxHp: 100,
      shield: 45,
      maxShield: 100,
      shieldRegen: 4,
      hitFlash: 0,
      pickupMagnetRadius: 84,
      invulnTimer: 0,
      dashCooldown: 0,
    };
  }

  private createStars(): Star[] {
    const stars: Star[] = [];
    for (let i = 0; i < 110; i += 1) {
      const layer = i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1;
      stars.push({ x: randomRange(0, WIDTH), y: randomRange(0, HEIGHT), size: layer === 3 ? 2 : layer === 2 ? 1.5 : 1, speed: layer * 30, layer });
    }
    return stars;
  }
}
