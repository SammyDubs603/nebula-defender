import type { EnemySpec } from './types';

export const ENEMY_SPECS: EnemySpec[] = [
  { type: 'drifter', unlockWave: 1, cost: 1, hp: 2, speed: 90, radius: 13, scoreValue: 100 },
  { type: 'zigzagger', unlockWave: 2, cost: 2, hp: 3, speed: 100, radius: 13, scoreValue: 130 },
  { type: 'tank', unlockWave: 4, cost: 4, hp: 9, speed: 62, radius: 19, scoreValue: 240 },
  { type: 'dasher', unlockWave: 5, cost: 3, hp: 4, speed: 100, radius: 14, scoreValue: 180 },
  { type: 'shooter', unlockWave: 6, cost: 4, hp: 5, speed: 74, radius: 15, scoreValue: 210 },
  { type: 'splitter', unlockWave: 8, cost: 4, hp: 4, speed: 95, radius: 15, scoreValue: 220 },
];
