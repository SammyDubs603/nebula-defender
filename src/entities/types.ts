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
  shield: number;
  hitFlash: number;
};

export type Bullet = {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  ttl: number;
  fromEnemy: boolean;
};

export type EnemyType = 'drone' | 'charger';

export type Enemy = {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  hp: number;
  speed: number;
  fireCooldown: number;
  type: EnemyType;
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

export type GameState = 'menu' | 'settings' | 'playing' | 'paused' | 'gameOver' | 'warning';
