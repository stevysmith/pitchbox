import * as Phaser from "phaser";
import { EventBus } from "../lib/EventBus";

/**
 * UIScene — parallel HUD scene that renders score and timer
 * with its own camera (unaffected by game camera shake/zoom).
 * Game scenes emit "score-update" and "timer-update" events.
 */
export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private boundScoreUpdate: ((data: { score: number }) => void) | null = null;
  private boundTimerUpdate: ((data: { timeLeft: number }) => void) | null = null;
  private _destroyed: boolean = false;

  constructor() {
    super({ key: "UIScene" });
  }

  create(): void {
    this._destroyed = false;
    const cam = this.cameras.main;
    const hudFont = "'Segoe UI', Arial, sans-serif";

    // Score display
    this.scoreText = this.add.text(10, 10, "Score: 0", {
      fontSize: "18px",
      fontFamily: hudFont,
      color: "#ffd700",
      stroke: "#000000",
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 4, fill: true, stroke: true },
      padding: { x: 4, y: 2 },
    });
    this.scoreText.setDepth(999);

    // Timer display
    this.timerText = this.add.text(cam.width - 10, 10, "", {
      fontSize: "18px",
      fontFamily: hudFont,
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 4, fill: true, stroke: true },
      padding: { x: 4, y: 2 },
    });
    this.timerText.setOrigin(1, 0);
    this.timerText.setDepth(999);

    // Listen for events from game scene
    this.boundScoreUpdate = (data: { score: number }) => {
      if (this._destroyed || !this.sys || !this.scoreText?.active) return;
      this.scoreText.setText(`Score: ${data.score}`);
      // Pop animation
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.4,
        scaleY: 1.4,
        duration: 80,
        yoyo: true,
        ease: "Back.easeOut",
      });
    };

    this.boundTimerUpdate = (data: { timeLeft: number }) => {
      if (this._destroyed || !this.sys || !this.timerText?.active) return;
      this.timerText.setText(`${Math.max(0, data.timeLeft)}s`);
      if (data.timeLeft <= 5 && data.timeLeft > 0) {
        this.timerText.setColor("#ff4444");
        this.tweens.add({
          targets: this.timerText,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 150,
          yoyo: true,
          ease: "Sine.easeInOut",
        });
      } else {
        this.timerText.setColor("#ffffff");
      }
    };

    EventBus.on("score-update", this.boundScoreUpdate);
    EventBus.on("timer-update", this.boundTimerUpdate);

    // Eagerly unsubscribe on scene shutdown/destroy
    this.events.on("shutdown", () => this.cleanup());
    this.events.on("destroy", () => this.cleanup());
  }

  private cleanup(): void {
    this._destroyed = true;
    if (this.boundScoreUpdate) {
      EventBus.off("score-update", this.boundScoreUpdate);
      this.boundScoreUpdate = null;
    }
    if (this.boundTimerUpdate) {
      EventBus.off("timer-update", this.boundTimerUpdate);
      this.boundTimerUpdate = null;
    }
  }

  shutdown(): void {
    this.cleanup();
  }
}
