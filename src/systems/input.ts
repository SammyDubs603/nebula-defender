import type { Vec2 } from '../entities/types';

export class InputState {
  private pressed = new Set<string>();

  private pointerHeld = false;

  constructor(private readonly listenElement: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.listenElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
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

  isShooting(): boolean {
    return this.pointerHeld || this.pressed.has('Space');
  }

  isPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  clearTransient(): void {
    this.pressed.delete('Escape');
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
