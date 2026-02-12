import type { Vec2 } from '../entities/types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const randomRange = (min: number, max: number): number => Math.random() * (max - min) + min;

export const distance = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const normalize = (v: Vec2): Vec2 => {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / len, y: v.y / len };
};
