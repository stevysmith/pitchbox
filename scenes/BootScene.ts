import * as Phaser from "phaser";

/**
 * BootScene — Phaser-native loading screen with progress bar.
 * Shown while sprites and assets load. Replaces the React loading overlay.
 */
export class BootScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    // Dark background
    this.cameras.main.setBackgroundColor("#0a0a0b");

    // Progress box (background)
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRoundedRect(cx - 120, cy - 15, 240, 30, 6);

    // Progress bar (foreground)
    this.progressBar = this.add.graphics();

    // Loading text
    this.loadingText = this.add.text(cx, cy - 35, "LOADING...", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#7c3aed",
    });
    this.loadingText.setOrigin(0.5);

    // Simulate brief load then transition to game scene
    let progress = 0;
    const fillTimer = this.time.addEvent({
      delay: 30,
      callback: () => {
        progress = Math.min(1, progress + 0.08);
        this.drawProgress(progress, cx, cy);
        if (progress >= 1) {
          fillTimer.destroy();
          // Transition to the game scene (started by PhaserGame.tsx)
          this.time.delayedCall(200, () => {
            this.scene.stop("BootScene");
          });
        }
      },
      loop: true,
    });
  }

  private drawProgress(value: number, cx: number, cy: number): void {
    this.progressBar.clear();
    this.progressBar.fillStyle(0x7c3aed, 1);
    this.progressBar.fillRoundedRect(
      cx - 116,
      cy - 11,
      232 * value,
      22,
      4
    );
  }
}
