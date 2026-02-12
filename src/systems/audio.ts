export class AudioSystem {
  private ctx: AudioContext | null = null;

  constructor(private enabled: boolean) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  unlock(): void {
    if (!this.enabled) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  shoot(): void {
    this.tone(340, 0.06, 'square', 0.03, 120);
  }

  explosion(): void {
    this.tone(90, 0.2, 'sawtooth', 0.08, -70);
  }

  pickup(): void {
    this.tone(520, 0.1, 'triangle', 0.05, 160);
  }

  hit(): void {
    this.tone(180, 0.08, 'square', 0.05, -40);
  }

  warning(): void {
    this.tone(240, 0.25, 'sawtooth', 0.08, 0);
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, slide: number): void {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const vol = this.ctx.createGain();
    const start = this.ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), start + duration);

    vol.gain.setValueAtTime(gain, start);
    vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(vol).connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }
}
