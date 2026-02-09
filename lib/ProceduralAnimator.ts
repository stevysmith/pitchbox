import * as Phaser from "phaser";

/**
 * ProceduralAnimator — per-frame scaleX/scaleY/rotation transforms
 * to animate sprites without spritesheets. State is determined from
 * physics velocity each frame.
 */

export type AnimState = "idle" | "run" | "jump" | "fall" | "hurt" | "dash";

export class ProceduralAnimator {
  private sprite: Phaser.GameObjects.Sprite;
  private state: AnimState = "idle";
  private time: number = 0;
  private baseScaleX: number;
  private baseScaleY: number;
  private hurtTimer: number = 0;

  constructor(sprite: Phaser.GameObjects.Sprite) {
    this.sprite = sprite;
    this.baseScaleX = sprite.scaleX;
    this.baseScaleY = sprite.scaleY;
  }

  /** Determine animation state from physics body. */
  setState(state: AnimState): void {
    if (state !== this.state) {
      this.state = state;
      if (state !== "hurt") {
        this.sprite.rotation = 0;
      }
    }
  }

  /** Call setState("hurt") to trigger a hurt animation for a duration. */
  triggerHurt(durationMs: number = 300): void {
    this.state = "hurt";
    this.hurtTimer = durationMs;
  }

  /** Determine state automatically from a physics body. */
  detectState(body: Phaser.Physics.Arcade.Body): AnimState {
    if (this.state === "hurt" && this.hurtTimer > 0) return "hurt";

    const onGround = body.touching.down || body.blocked.down;
    const vx = Math.abs(body.velocity.x);
    const vy = body.velocity.y;

    if (!onGround && vy < -20) return "jump";
    if (!onGround && vy > 20) return "fall";
    if (vx > 10) return "run";
    return "idle";
  }

  /** Update transforms each frame. Call from scene update(). */
  update(delta: number): void {
    this.time += delta;

    // Tick hurt timer
    if (this.hurtTimer > 0) {
      this.hurtTimer -= delta;
      if (this.hurtTimer <= 0) {
        this.hurtTimer = 0;
        this.state = "idle";
        this.sprite.rotation = 0;
      }
    }

    const t = this.time / 1000; // time in seconds

    switch (this.state) {
      case "idle":
        this.applyIdle(t);
        break;
      case "run":
        this.applyRun(t);
        break;
      case "jump":
        this.applyJump();
        break;
      case "fall":
        this.applyFall();
        break;
      case "hurt":
        this.applyHurt(t);
        break;
      case "dash":
        this.applyDash();
        break;
    }
  }

  // ── State Effects ──────────────────────────────────────────────

  /** Gentle breathing: Y scale oscillation +/-2% */
  private applyIdle(t: number): void {
    const breathe = Math.sin(t * 3) * 0.02;
    this.sprite.scaleX = this.baseScaleX;
    this.sprite.scaleY = this.baseScaleY * (1 + breathe);
    this.sprite.rotation = 0;
  }

  /** Bob + lean: Y +/-4%, rotation +/-0.05 */
  private applyRun(t: number): void {
    const bob = Math.sin(t * 12) * 0.04;
    const lean = Math.sin(t * 12) * 0.05;
    this.sprite.scaleX = this.baseScaleX;
    this.sprite.scaleY = this.baseScaleY * (1 + bob);
    this.sprite.rotation = lean;
  }

  /** Vertical stretch: X 0.85, Y 1.15 */
  private applyJump(): void {
    this.sprite.scaleX = this.baseScaleX * 0.85;
    this.sprite.scaleY = this.baseScaleY * 1.15;
    this.sprite.rotation = 0;
  }

  /** Horizontal flatten: X 1.05, Y 0.95 */
  private applyFall(): void {
    this.sprite.scaleX = this.baseScaleX * 1.05;
    this.sprite.scaleY = this.baseScaleY * 0.95;
    this.sprite.rotation = 0;
  }

  /** Rapid rotation shake */
  private applyHurt(t: number): void {
    this.sprite.rotation = Math.sin(t * 40) * 0.15;
    this.sprite.scaleX = this.baseScaleX;
    this.sprite.scaleY = this.baseScaleY;
  }

  /** Horizontal stretch: X 1.3, Y 0.8 */
  private applyDash(): void {
    this.sprite.scaleX = this.baseScaleX * 1.3;
    this.sprite.scaleY = this.baseScaleY * 0.8;
    this.sprite.rotation = 0;
  }

  /** Reset transforms. */
  reset(): void {
    this.sprite.scaleX = this.baseScaleX;
    this.sprite.scaleY = this.baseScaleY;
    this.sprite.rotation = 0;
    this.state = "idle";
    this.time = 0;
  }
}
