export type Vec2 = {
  x: number;
  y: number;
};

export type Player = {
  position: Vec2;
  velocity: Vec2;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldRegen: number;
  hitFlash: number;
  pickupMagnetRadius: number;
  invulnTimer: number;
  dashCooldown: number;
};

export type Bullet = {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  ttl: number;
  fromEnemy: boolean;
  damage: number;
  pierce: number;
  crit: boolean;
};

export type EnemyType = 'drifter' | 'zigzagger' | 'tank' | 'dasher' | 'shooter' | 'splitter' | 'splitDrone';

export type Enemy = {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  fireCooldown: number;
  type: EnemyType;
  scoreValue: number;
  elite: boolean;
  age: number;
  aiTimer: number;
  dashWindow: number;
  zigPhase: number;
};

export type PickupType = 'health' | 'shield';

export type Pickup = {
  position: Vec2;
  radius: number;
  velocityY: number;
  type: PickupType;
};

export type Particle = {
  position: Vec2;
  velocity: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

export type DamageNumber = {
  position: Vec2;
  velocity: Vec2;
  value: number;
  crit: boolean;
  life: number;
  maxLife: number;
};

export type Star = {
  x: number;
  y: number;
  size: number;
  speed: number;
  layer: number;
};

export type Boss = {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  patternTimer: number;
  phase: 1 | 2 | 3;
  alive: boolean;
};

export type UpgradeId =
  | 'fireRate'
  | 'damage'
  | 'projectileSpeed'
  | 'extraProjectile'
  | 'pierce'
  | 'critChance'
  | 'magnet'
  | 'maxHp'
  | 'maxShield'
  | 'shieldRegen'
  | 'moveSpeed'
  | 'dash';

export type UpgradeDefinition = {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
};

export type RunUpgrades = Record<UpgradeId, number>;

export type EnemySpec = {
  type: EnemyType;
  unlockWave: number;
  cost: number;
  hp: number;
  speed: number;
  radius: number;
  scoreValue: number;
};

export type GameState = 'menu' | 'settings' | 'playing' | 'paused' | 'gameOver' | 'warning' | 'upgrade';
