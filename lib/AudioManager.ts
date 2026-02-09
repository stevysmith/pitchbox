/**
 * AudioManager — procedural audio synthesis using Web Audio API.
 * No asset files needed. Generates all SFX via oscillator sweeps
 * and provides a simple arpeggiated BGM loop.
 */

type SFXType =
  | "collect"
  | "hit"
  | "jump"
  | "land"
  | "tick"
  | "countdown"
  | "go"
  | "shoot"
  | "dash"
  | "match"
  | "correct"
  | "wrong";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmInterval: ReturnType<typeof setInterval> | null = null;
  private bgmRunning: boolean = false;
  private muted: boolean = false;

  /** Lazily create AudioContext on first user interaction. */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.4;
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.15;
      this.bgmGain.connect(this.masterGain);

      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Resume suspended AudioContext (required after user gesture). */
  resume(): void {
    if (this.ctx?.state === "suspended") {
      this.ctx.resume();
    }
  }

  // ── SFX ────────────────────────────────────────────────────────

  playSFX(type: SFXType): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    switch (type) {
      case "collect":
        this.sweep(ctx, this.sfxGain, "sine", 600, 1200, 0.15, 0.25);
        break;
      case "hit":
        this.sweep(ctx, this.sfxGain, "sawtooth", 200, 80, 0.25, 0.2);
        break;
      case "jump":
        this.sweep(ctx, this.sfxGain, "sine", 300, 600, 0.12, 0.2);
        break;
      case "land":
        this.sweep(ctx, this.sfxGain, "triangle", 150, 60, 0.08, 0.15);
        break;
      case "tick":
        this.ping(ctx, this.sfxGain, 880, 0.05, 0.15);
        break;
      case "countdown":
        this.ping(ctx, this.sfxGain, 440, 0.2, 0.3);
        break;
      case "go":
        this.ping(ctx, this.sfxGain, 880, 0.3, 0.4);
        break;
      case "shoot":
        this.sweep(ctx, this.sfxGain, "sawtooth", 800, 200, 0.1, 0.15);
        break;
      case "dash":
        this.sweep(ctx, this.sfxGain, "sawtooth", 150, 400, 0.15, 0.2);
        break;
      case "match":
        this.sweep(ctx, this.sfxGain, "sine", 400, 800, 0.2, 0.3);
        break;
      case "correct":
        this.doubleBeep(ctx, this.sfxGain, 523, 659, 0.12);
        break;
      case "wrong":
        this.doubleBeep(ctx, this.sfxGain, 300, 200, 0.15);
        break;
    }
  }

  private sweep(
    ctx: AudioContext,
    dest: GainNode,
    wave: OscillatorType,
    startHz: number,
    endHz: number,
    duration: number,
    volume: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(startHz, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(endHz, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  }

  private ping(
    ctx: AudioContext,
    dest: GainNode,
    hz: number,
    duration: number,
    volume: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(hz, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  }

  private doubleBeep(
    ctx: AudioContext,
    dest: GainNode,
    hz1: number,
    hz2: number,
    noteLen: number
  ): void {
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const hz = i === 0 ? hz1 : hz2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(hz, now + i * noteLen);
      gain.gain.setValueAtTime(0.2, now + i * noteLen);
      gain.gain.linearRampToValueAtTime(0, now + i * noteLen + noteLen * 0.9);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now + i * noteLen);
      osc.stop(now + (i + 1) * noteLen);
    }
  }

  // ── BGM ────────────────────────────────────────────────────────

  /** Simple arpeggiated chord loop. */
  startBGM(): void {
    if (this.bgmRunning || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain) return;

    this.bgmRunning = true;

    // C minor: C3, Eb3, G3, Bb3 (arpeggio pattern)
    const notes = [130.81, 155.56, 196.0, 233.08, 196.0, 155.56];
    let noteIndex = 0;

    this.bgmInterval = setInterval(() => {
      if (!this.bgmRunning || !ctx || !this.bgmGain) return;
      const hz = notes[noteIndex % notes.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(hz, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
      noteIndex++;
    }, 250);
  }

  stopBGM(): void {
    this.bgmRunning = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  // ── Between-Round Audio (Phase 4D) ──────────────────────────────

  /** Countdown beeps: pitched up for GO */
  countdownBeep(count: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    if (count > 0) {
      this.ping(ctx, this.sfxGain, 440, 0.15, 0.2);
    } else {
      this.doubleBeep(ctx, this.sfxGain, 660, 880, 0.1);
    }
  }

  /** Drumroll during reveal. Returns interval ID for cleanup. */
  drumroll(): ReturnType<typeof setInterval> | null {
    if (this.muted) return null;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return null;
    let i = 0;
    const interval = setInterval(() => {
      if (i >= 16 || !ctx || !this.sfxGain) { clearInterval(interval); return; }
      this.ping(ctx, this.sfxGain, 100 + Math.random() * 40, 0.06, 0.06 + i * 0.003);
      i++;
    }, 80);
    return interval;
  }

  /** Victory fanfare for winner reveal */
  fanfare(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.ping(ctx, this.sfxGain, 523, 0.15, 0.15);
    setTimeout(() => this.ping(ctx, this.sfxGain!, 659, 0.15, 0.15), 120);
    setTimeout(() => this.ping(ctx, this.sfxGain!, 784, 0.15, 0.15), 240);
    setTimeout(() => {
      this.ping(ctx, this.sfxGain!, 1047, 0.3, 0.2);
    }, 400);
  }

  /** Suspense sound when scores are close */
  suspense(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.sweep(ctx, this.sfxGain, "sine", 200, 220, 0.8, 0.06);
  }

  /** New leader alert */
  newLeader(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.ping(ctx, this.sfxGain, 587, 0.08, 0.12);
    setTimeout(() => this.ping(ctx, this.sfxGain!, 784, 0.08, 0.12), 60);
    setTimeout(() => this.ping(ctx, this.sfxGain!, 1047, 0.12, 0.15), 120);
  }

  /** Score tick for counting animation */
  scoreTick(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.ping(ctx, this.sfxGain, 800 + Math.random() * 200, 0.03, 0.04);
  }

  // ── Controls ───────────────────────────────────────────────────

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopBGM();
    }
    return this.muted;
  }

  destroy(): void {
    this.stopBGM();
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
  }
}
