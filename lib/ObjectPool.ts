import * as Phaser from "phaser";

/**
 * ObjectPool — wraps Phaser's recommended setActive(false)/setVisible(false)
 * pattern for efficient sprite reuse in spawn-heavy scenes.
 */
export class ObjectPool {
  private scene: Phaser.Scene;
  private group: Phaser.Physics.Arcade.Group;
  private textureKey: string;
  private displaySize: number;

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    displaySize: number,
    initialSize: number = 10
  ) {
    this.scene = scene;
    this.textureKey = textureKey;
    this.displaySize = displaySize;

    this.group = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: -1, // unlimited, but we reuse
      runChildUpdate: false,
    });

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      const sprite = this.group.create(-100, -100, textureKey) as Phaser.Physics.Arcade.Sprite;
      sprite.setDisplaySize(displaySize, displaySize);
      sprite.setActive(false);
      sprite.setVisible(false);
      if (sprite.body) {
        (sprite.body as Phaser.Physics.Arcade.Body).enable = false;
      }
    }
  }

  /** Reactivate a dead sprite or grow pool. Returns the sprite. */
  spawn(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    // Find an inactive sprite
    let sprite = this.group.getFirstDead(false) as Phaser.Physics.Arcade.Sprite | null;

    if (!sprite) {
      // Grow pool
      sprite = this.group.create(x, y, this.textureKey) as Phaser.Physics.Arcade.Sprite;
      sprite.setDisplaySize(this.displaySize, this.displaySize);
    } else {
      sprite.setPosition(x, y);
      sprite.setActive(true);
      sprite.setVisible(true);
      sprite.setAlpha(1);
      sprite.clearTint();
      if (sprite.body) {
        (sprite.body as Phaser.Physics.Arcade.Body).enable = true;
        (sprite.body as Phaser.Physics.Arcade.Body).reset(x, y);
      }
    }

    return sprite;
  }

  /** Deactivate a sprite and return it to pool. */
  despawn(sprite: Phaser.Physics.Arcade.Sprite): void {
    sprite.setActive(false);
    sprite.setVisible(false);
    if (sprite.body) {
      (sprite.body as Phaser.Physics.Arcade.Body).enable = false;
      (sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
    sprite.setPosition(-100, -100);
  }

  /** Get the underlying group for overlap/collider registration. */
  getGroup(): Phaser.Physics.Arcade.Group {
    return this.group;
  }

  /** Despawn all active sprites. */
  despawnAll(): void {
    const children = this.group.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const child of children) {
      if (child.active) {
        this.despawn(child);
      }
    }
  }

  destroy(): void {
    this.group.destroy(true);
  }
}
