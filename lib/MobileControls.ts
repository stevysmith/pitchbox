import * as Phaser from "phaser";

export interface MobileControlState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
}

export class MobileControls {
  private scene: Phaser.Scene;
  private joystickBase: Phaser.GameObjects.Arc | null = null;
  private joystickThumb: Phaser.GameObjects.Arc | null = null;
  private actionButton: Phaser.GameObjects.Arc | null = null;
  private actionLabel: Phaser.GameObjects.Text | null = null;
  private state: MobileControlState = {
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
  };
  private joystickPointer: Phaser.Input.Pointer | null = null;
  private baseX: number = 0;
  private baseY: number = 0;
  private isTouch: boolean = false;
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, actionLabel: string = "JUMP") {
    this.scene = scene;
    this.isTouch = scene.sys.game.device.input.touch;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(1000);
    this.container.setScrollFactor(0);

    if (!this.isTouch) return;

    this.createJoystick();
    this.createActionButton(actionLabel);
    this.setupInputHandlers();
  }

  private createJoystick(): void {
    const cam = this.scene.cameras.main;
    this.baseX = 80;
    this.baseY = cam.height - 80;

    this.joystickBase = this.scene.add.circle(this.baseX, this.baseY, 50, 0x333333, 0.4);
    this.joystickBase.setScrollFactor(0);
    this.joystickBase.setDepth(1000);

    this.joystickThumb = this.scene.add.circle(this.baseX, this.baseY, 24, 0xaaaaaa, 0.6);
    this.joystickThumb.setScrollFactor(0);
    this.joystickThumb.setDepth(1001);

    this.container.add([this.joystickBase, this.joystickThumb]);
  }

  private createActionButton(label: string): void {
    const cam = this.scene.cameras.main;
    const btnX = cam.width - 70;
    const btnY = cam.height - 80;

    this.actionButton = this.scene.add.circle(btnX, btnY, 35, 0x7c3aed, 0.5);
    this.actionButton.setScrollFactor(0);
    this.actionButton.setDepth(1000);
    this.actionButton.setInteractive();

    this.actionLabel = this.scene.add.text(btnX, btnY, label, {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#ffffff",
      align: "center",
    });
    this.actionLabel.setOrigin(0.5);
    this.actionLabel.setScrollFactor(0);
    this.actionLabel.setDepth(1001);

    this.actionButton.on("pointerdown", () => {
      this.state.action = true;
      this.actionButton?.setFillStyle(0x9b59b6, 0.7);
    });
    this.actionButton.on("pointerup", () => {
      this.state.action = false;
      this.actionButton?.setFillStyle(0x7c3aed, 0.5);
    });
    this.actionButton.on("pointerout", () => {
      this.state.action = false;
      this.actionButton?.setFillStyle(0x7c3aed, 0.5);
    });

    this.container.add([this.actionButton, this.actionLabel]);
  }

  private setupInputHandlers(): void {
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Only handle left half of screen for joystick
      if (pointer.x < this.scene.cameras.main.width / 2 && !this.joystickPointer) {
        this.joystickPointer = pointer;
      }
    });

    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer !== this.joystickPointer || !this.joystickThumb) return;

      const dx = pointer.x - this.baseX;
      const dy = pointer.y - this.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 40;

      if (dist > 0) {
        const clampedDist = Math.min(dist, maxDist);
        const nx = dx / dist;
        const ny = dy / dist;
        this.joystickThumb.x = this.baseX + nx * clampedDist;
        this.joystickThumb.y = this.baseY + ny * clampedDist;

        const threshold = 0.3;
        this.state.left = nx < -threshold;
        this.state.right = nx > threshold;
        this.state.up = ny < -threshold;
        this.state.down = ny > threshold;
      }
    });

    this.scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer === this.joystickPointer && this.joystickThumb) {
        this.joystickPointer = null;
        this.joystickThumb.x = this.baseX;
        this.joystickThumb.y = this.baseY;
        this.state.left = false;
        this.state.right = false;
        this.state.up = false;
        this.state.down = false;
      }
    });
  }

  getState(): MobileControlState {
    return { ...this.state };
  }

  destroy(): void {
    this.container.destroy(true);
    this.joystickBase = null;
    this.joystickThumb = null;
    this.actionButton = null;
    this.actionLabel = null;
  }
}
