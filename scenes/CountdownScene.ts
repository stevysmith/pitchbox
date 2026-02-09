import * as Phaser from "phaser";
import { EventBus } from "../lib/EventBus";

/**
 * CountdownScene — parallel overlay scene showing "3... 2... 1... GO!"
 * Launched on top of the game scene. Emits "countdown-complete" when done.
 */
export class CountdownScene extends Phaser.Scene {
  constructor() {
    super({ key: "CountdownScene" });
  }

  create(): void {
    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    // Semi-transparent overlay
    const overlay = this.add.rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.5);
    overlay.setDepth(0);

    const numbers = ["3", "2", "1"];
    let index = 0;

    const showNumber = () => {
      if (index < numbers.length) {
        this.showCountdownNumber(cx, cy, numbers[index], "#ffffff");

        // Play countdown SFX via EventBus (AudioManager lives on game scene)
        EventBus.emit("countdown-sfx", "countdown");

        index++;
        this.time.delayedCall(700, showNumber);
      } else {
        // Show "GO!"
        this.showCountdownNumber(cx, cy, "GO!", "#2ecc71");
        EventBus.emit("countdown-sfx", "go");

        this.time.delayedCall(500, () => {
          // Fade overlay out
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
          });

          // Emit completion
          EventBus.emit("countdown-complete");

          this.time.delayedCall(300, () => {
            this.scene.stop("CountdownScene");
          });
        });
      }
    };

    // Start after a brief pause
    this.time.delayedCall(300, showNumber);
  }

  private showCountdownNumber(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontSize: "64px",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontStyle: "bold",
      color,
      stroke: "#000000",
      strokeThickness: 6,
    });
    t.setOrigin(0.5);
    t.setDepth(10);
    t.setScale(0);

    // Scale in
    this.tweens.add({
      targets: t,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: "Back.easeOut",
    });

    // Fade out
    this.tweens.add({
      targets: t,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 300,
      delay: 400,
      onComplete: () => t.destroy(),
    });
  }
}
