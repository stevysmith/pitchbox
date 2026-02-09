import * as Phaser from "phaser";
import { SceneConfig, RemotePlayerState, PLAYER_COLORS, TILE_SIZE, PLAYER_DISPLAY_SIZE, COLLECTIBLE_DISPLAY_SIZE, HAZARD_DISPLAY_SIZE } from "../lib/phaserTypes";
import { MultiplayerManager } from "../lib/MultiplayerManager";
import { MobileControls } from "../lib/MobileControls";
import { EventBus } from "../lib/EventBus";
import { JuiceManager } from "../lib/JuiceManager";
import { AudioManager } from "../lib/AudioManager";
import { ProceduralAnimator } from "../lib/ProceduralAnimator";
import { createPlayerSprite, createCollectibleSprite, createHazardSprite, createGroundTile, createPlatformTile, createModernGroundTile, createModernPlatformTile, createSkyBackground } from "../lib/SpriteFactory";
import { parseTilemap, LevelData, TILE_GROUND, TILE_PLATFORM, TILE_HAZARD } from "../lib/LevelGenerator";

export interface BaseSceneData {
  config: SceneConfig;
  playerId: string;
  playerName: string;
  playerEmoji: string;
  playerIndex: number;
  roomId: string;
  round: number;
  updatePositionMutation: any;
  allPlayers: { _id: string; name: string; emoji: string }[];
}

export class BaseScene extends Phaser.Scene {
  protected config!: SceneConfig;
  protected playerId!: string;
  protected playerName!: string;
  protected playerEmoji!: string;
  protected playerColor!: string;
  protected roomId!: string;
  protected round!: number;
  protected allPlayers!: { _id: string; name: string; emoji: string }[];

  protected player!: Phaser.GameObjects.Sprite;
  protected playerBody!: Phaser.Physics.Arcade.Body;
  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  protected wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  protected mobileControls!: MobileControls;

  protected multiplayer!: MultiplayerManager;
  protected remoteSpriteMap: Map<string, Phaser.GameObjects.Container> = new Map();
  protected boundOnRemotePlayersUpdated: ((remotePlayers: RemotePlayerState[]) => void) | null = null;

  protected score: number = 0;
  protected scoreText!: Phaser.GameObjects.Text;
  protected timerText!: Phaser.GameObjects.Text;
  protected timeLeft: number = 0;
  protected roundActive: boolean = false;

  protected _useAIPlayerSprite: boolean = false;
  _destroyed: boolean = false;

  // Juice, Audio & Animation systems
  protected juice!: JuiceManager;
  protected audio!: AudioManager;
  protected animator!: ProceduralAnimator;
  private _wasOnGround: boolean = false;

  // Coyote time & jump buffering (Phase 7)
  protected _coyoteTimer: number = 0;
  protected _jumpBufferTimer: number = 0;
  private static readonly COYOTE_TIME = 80;
  private static readonly JUMP_BUFFER_TIME = 100;

  protected levelData!: LevelData;
  protected groundGroup!: Phaser.Physics.Arcade.StaticGroup;
  protected platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  protected collectibleGroup!: Phaser.Physics.Arcade.Group;
  protected hazardGroup!: Phaser.Physics.Arcade.StaticGroup;

  constructor(key: string) {
    super({ key });
  }

  init(data: BaseSceneData): void {
    this.config = data.config;
    this.playerId = data.playerId;
    this.playerName = data.playerName;
    this.playerEmoji = data.playerEmoji;
    this.playerColor = PLAYER_COLORS[data.playerIndex % PLAYER_COLORS.length];
    this.roomId = data.roomId;
    this.round = data.round;
    this.allPlayers = data.allPlayers;
    this.score = 0;
    this.roundActive = false;
    this._destroyed = false;
    this.timeLeft = this.config.timeLimit || 30;
    this.remoteSpriteMap.clear();

    this.multiplayer = new MultiplayerManager(
      data.playerId,
      data.roomId,
      data.round,
      data.updatePositionMutation
    );
  }

  preload(): void {
    const sprites = this.config.spriteImages;

    // Enable CORS for cross-origin sprite URLs (Convex file storage)
    if (sprites && Object.keys(sprites).length > 0) {
      this.load.setCORS("anonymous");
    }

    // Background: AI image or procedural
    if (sprites?.background) {
      this.load.image("sky_bg", sprites.background);
    } else {
      createSkyBackground(this, this.config.colors?.sky || "#1a1a2e");
    }

    // Ground tile: modern procedural or pixel procedural
    // (AI tiles are 1024x1024 but display at 32x32 — extreme downscaling destroys detail)
    const artStyle = this.config.artStyle;
    if (artStyle !== "pixel") {
      createModernGroundTile(this, this.config.colors?.ground || "#4a7c59");
    } else {
      createGroundTile(this, this.config.colors?.ground || "#4a7c59");
    }

    // Platform tile: modern procedural or pixel procedural
    if (artStyle !== "pixel") {
      createModernPlatformTile(this, this.config.colors?.platform || "#8b6914");
    } else {
      createPlatformTile(this, this.config.colors?.platform || "#8b6914");
    }

    // Collectible: AI image or procedural
    if (sprites?.collectible) {
      this.load.image("collectible", sprites.collectible);
    } else {
      createCollectibleSprite(this, this.config.colors?.collectible || "#ffd700");
    }

    // Hazard: AI image or procedural
    if (sprites?.hazard) {
      this.load.image("hazard", sprites.hazard);
    } else {
      createHazardSprite(this, this.config.colors?.hazard || "#ff4444");
    }

    // Player: AI image with tint, or procedural per-player
    if (sprites?.player) {
      this.load.image("player_template", sprites.player);
      this._useAIPlayerSprite = true;
    } else {
      createPlayerSprite(this, this.playerId, this.playerColor);
      this.allPlayers.forEach((p, i) => {
        if (p._id !== this.playerId) {
          createPlayerSprite(this, p._id, PLAYER_COLORS[i % PLAYER_COLORS.length]);
        }
      });
    }
  }

  create(): void {
    // Initialize juice & audio systems
    JuiceManager.ensureWhiteTexture(this);
    this.juice = new JuiceManager(this);
    this.audio = new AudioManager();
    this.audio.resume();

    // Parse or generate level
    this.levelData = parseTilemap(this.config);

    // Background
    const bg = this.add.image(0, 0, "sky_bg");
    bg.setOrigin(0, 0);
    bg.setDisplaySize(
      Math.max(this.cameras.main.width, this.levelData.width * TILE_SIZE * 2),
      Math.max(this.cameras.main.height, this.levelData.height * TILE_SIZE * 2)
    );
    bg.setScrollFactor(0.3);

    // Parallax midground layer
    this.createParallaxLayers();

    // Physics groups
    this.groundGroup = this.physics.add.staticGroup();
    this.platformGroup = this.physics.add.staticGroup();
    this.collectibleGroup = this.physics.add.group();
    this.hazardGroup = this.physics.add.staticGroup();

    // Build tilemap
    this.buildTilemap();

    // Create player
    this.createPlayer();

    // Procedural animator
    this.animator = new ProceduralAnimator(this.player);

    // Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
    this.mobileControls = new MobileControls(this, "JUMP");

    // HUD — launch parallel UIScene + keep local refs for backward compat
    this.scene.launch("UIScene");
    this.createHUD();

    // Collisions
    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.collider(this.player, this.platformGroup);

    // Collectible overlap
    this.physics.add.overlap(
      this.player,
      this.collectibleGroup,
      this.onCollectItem as any,
      undefined,
      this
    );

    // Hazard overlap
    this.physics.add.overlap(
      this.player,
      this.hazardGroup,
      this.onHitHazard as any,
      undefined,
      this
    );

    // Start round timer (gated on roundActive, set after countdown)
    this.roundActive = false;
    this.time.addEvent({
      delay: 1000,
      callback: this.tickTimer,
      callbackScope: this,
      loop: true,
    });

    // Launch countdown overlay
    this.scene.launch("CountdownScene");

    // Listen for countdown completion
    const onCountdownComplete = () => {
      this.roundActive = true;
      this.audio?.startBGM();
      EventBus.off("countdown-complete", onCountdownComplete);
    };
    EventBus.on("countdown-complete", onCountdownComplete);

    // Listen for countdown SFX
    const onCountdownSfx = (type: string) => {
      this.audio?.playSFX(type as any);
    };
    EventBus.on("countdown-sfx", onCountdownSfx);
    this.events.on("shutdown", () => {
      EventBus.off("countdown-sfx", onCountdownSfx);
    });

    // Camera fade in
    this.cameras.main.fadeIn(400);

    // Listen for remote player updates
    this.boundOnRemotePlayersUpdated = this.onRemotePlayersUpdated.bind(this);
    EventBus.on("remote-players-updated", this.boundOnRemotePlayersUpdated);

    // Eagerly unsubscribe all EventBus listeners on scene shutdown/destroy
    this.events.on("shutdown", () => this.cleanupEventBus());
    this.events.on("destroy", () => this.cleanupEventBus());

    // Emit scene ready
    EventBus.emit("scene-ready", this.scene.key);
  }

  protected createParallaxLayers(): void {
    const worldW = Math.max(this.cameras.main.width, this.levelData.width * TILE_SIZE * 2);
    const worldH = Math.max(this.cameras.main.height, this.levelData.height * TILE_SIZE * 2);

    const skyColor = this.config.colors?.sky || "#1a1a2e";
    const skyC = Phaser.Display.Color.HexStringToColor(skyColor);
    // Slightly lighter than sky for midground silhouettes
    const midColor = Phaser.Display.Color.GetColor(
      Math.min(255, skyC.red + 25),
      Math.min(255, skyC.green + 20),
      Math.min(255, skyC.blue + 30)
    );

    const gfx = this.add.graphics();
    gfx.setScrollFactor(0.5);
    gfx.setDepth(-1);
    gfx.setAlpha(0.2);

    // Scatter 8-15 rounded rectangles as abstract silhouettes
    const count = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const rx = Math.random() * worldW;
      const ry = worldH * 0.3 + Math.random() * worldH * 0.7;
      const rw = 20 + Math.random() * 80;
      const rh = 30 + Math.random() * 100;
      gfx.fillStyle(midColor, 0.15 + Math.random() * 0.1);
      gfx.fillRoundedRect(rx, ry, rw, rh, 6);
    }
  }

  protected buildTilemap(): void {
    const { tilemap } = this.levelData;
    const scale = 2; // Render tiles at 2x for pixel art crispness

    for (let y = 0; y < tilemap.length; y++) {
      for (let x = 0; x < (tilemap[y]?.length || 0); x++) {
        const tile = tilemap[y][x];
        const px = x * TILE_SIZE * scale;
        const py = y * TILE_SIZE * scale;

        if (tile === TILE_GROUND) {
          const sprite = this.groundGroup.create(px + TILE_SIZE, py + TILE_SIZE, "ground_tile") as Phaser.Physics.Arcade.Sprite;
          sprite.setDisplaySize(TILE_SIZE * scale, TILE_SIZE * scale);
          // Only apply tint variation for pixel art — modern/AI tiles need seamless tiling
          if (this.config.artStyle === "pixel") {
            const variation = 0.95 + Math.random() * 0.1;
            const tintVal = Math.round(255 * variation);
            sprite.setTint(Phaser.Display.Color.GetColor(tintVal, tintVal, tintVal));
          }
          sprite.refreshBody();
        } else if (tile === TILE_PLATFORM) {
          const sprite = this.platformGroup.create(px + TILE_SIZE, py + TILE_SIZE, "platform_tile") as Phaser.Physics.Arcade.Sprite;
          sprite.setDisplaySize(TILE_SIZE * scale, TILE_SIZE * scale);
          if (this.config.artStyle === "pixel") {
            const variation = 0.95 + Math.random() * 0.1;
            const tintVal = Math.round(255 * variation);
            sprite.setTint(Phaser.Display.Color.GetColor(tintVal, tintVal, tintVal));
          }
          sprite.refreshBody();
        } else if (tile === TILE_HAZARD) {
          const sprite = this.hazardGroup.create(px + TILE_SIZE, py + TILE_SIZE, "hazard") as Phaser.Physics.Arcade.Sprite;
          sprite.setDisplaySize(HAZARD_DISPLAY_SIZE, HAZARD_DISPLAY_SIZE);
          sprite.refreshBody();
        }
      }
    }

    // Add collectibles from level data
    for (const pos of this.levelData.collectiblePositions) {
      const sprite = this.collectibleGroup.create(pos.x * 2 + TILE_SIZE, pos.y * 2 + TILE_SIZE, "collectible") as Phaser.Physics.Arcade.Sprite;
      sprite.setDisplaySize(COLLECTIBLE_DISPLAY_SIZE, COLLECTIBLE_DISPLAY_SIZE);
      if (sprite.body) {
        (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      }
      // Bobbing animation
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 6,
        duration: 800,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }
  }

  protected createPlayer(): void {
    const spawnX = this.levelData.playerSpawnX * 2;
    const spawnY = this.levelData.playerSpawnY * 2;

    const textureKey = this._useAIPlayerSprite ? "player_template" : `player_${this.playerId}`;
    this.player = this.physics.add.sprite(spawnX, spawnY, textureKey);
    this.player.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE);
    if (this._useAIPlayerSprite) {
      this.player.setTint(Phaser.Display.Color.HexStringToColor(this.playerColor).color);
    }
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.playerBody.setSize(TILE_SIZE * 1.5, TILE_SIZE * 1.8);

    // Name tag
    const nameTagY = -(PLAYER_DISPLAY_SIZE / 2 + 6);
    const nameTag = this.add.text(0, nameTagY, this.playerName, {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { x: 3, y: 1 },
    });
    nameTag.setOrigin(0.5);

    // Update name tag position each frame
    this.events.on("update", () => {
      nameTag.setPosition(this.player.x, this.player.y + nameTagY);
    });
  }

  protected createHUD(): void {
    const hudFont = "'Segoe UI', Arial, sans-serif";

    // Score
    this.scoreText = this.add.text(10, 10, "Score: 0", {
      fontSize: "18px",
      fontFamily: hudFont,
      color: "#ffd700",
      stroke: "#000000",
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 4, fill: true, stroke: true },
      padding: { x: 4, y: 2 },
    });
    this.scoreText.setScrollFactor(0);
    this.scoreText.setDepth(999);

    // Timer
    this.timerText = this.add.text(this.cameras.main.width - 10, 10, `${this.timeLeft}s`, {
      fontSize: "18px",
      fontFamily: hudFont,
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 4, fill: true, stroke: true },
      padding: { x: 4, y: 2 },
    });
    this.timerText.setOrigin(1, 0);
    this.timerText.setScrollFactor(0);
    this.timerText.setDepth(999);
  }

  protected tickTimer(): void {
    if (this._destroyed || !this.roundActive) return;
    this.timeLeft--;
    this.timerText?.setText(`${Math.max(0, this.timeLeft)}s`);

    // Emit to UIScene
    EventBus.emit("timer-update", { timeLeft: this.timeLeft });

    if (this.timeLeft <= 5 && this.timeLeft > 0) {
      // Juice: timer urgency pulse
      if (this.timerText) this.juice?.timerUrgency(this.timerText);
      // Audio: tick SFX
      this.audio?.playSFX("tick");
    }

    if (this.timeLeft <= 0) {
      this.endRound();
    }
  }

  protected addScore(points: number): void {
    this.score += points;
    this.scoreText?.setText(`Score: ${this.score}`);

    // Emit to UIScene
    EventBus.emit("score-update", { score: this.score });

    // Juice: score pop + floating text
    if (this.scoreText) this.juice?.scorePop(this.scoreText);
    if (this.player?.active) {
      const sign = points >= 0 ? "+" : "";
      const color = points >= 0 ? "#ffd700" : "#ff4444";
      this.juice?.floatingText(
        this.player.x,
        this.player.y - this.player.displayHeight / 2 - 10,
        `${sign}${points}`,
        color
      );
    }
  }

  protected onCollectItem(
    player: Phaser.GameObjects.Sprite,
    item: Phaser.GameObjects.Sprite
  ): void {
    const ix = item.x;
    const iy = item.y;
    item.destroy();
    const points = this.config.scoring?.collectiblePoints || 10;
    this.addScore(points);

    // Juice: collect burst with particles + floating score
    this.juice?.collectBurst(ix, iy, points, "collectible");
    // Audio: collect SFX
    this.audio?.playSFX("collect");
  }

  protected onHitHazard(
    player: Phaser.GameObjects.Sprite,
    hazard: Phaser.GameObjects.Sprite
  ): void {
    this.addScore(-5);

    // Juice: damage flash (shake + blink + floating text)
    this.juice?.damageFlash(this.player, -5);
    // Audio: hit SFX
    this.audio?.playSFX("hit");
  }

  protected endRound(): void {
    if (!this.roundActive) return;
    this.roundActive = false;

    // Stop BGM
    this.audio?.stopBGM();

    // Time dilation
    if (this.physics?.world) {
      this.physics.world.timeScale = 3; // slow motion
    }

    // Camera zoom
    this.cameras.main.zoomTo(1.3, 600, "Quad.easeOut");

    // Confetti burst
    this.juice?.confettiBurst(
      this.cameras.main.centerX,
      this.cameras.main.centerY
    );

    // Show final score with scale-in animation
    const finalText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      `SCORE: ${this.score}`,
      {
        fontSize: "32px",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontStyle: "bold",
        color: "#ffd700",
        stroke: "#000000",
        strokeThickness: 4,
        shadow: { offsetX: 2, offsetY: 2, color: "#000000", blur: 8, fill: true, stroke: true },
        padding: { x: 20, y: 12 },
      }
    );
    finalText.setOrigin(0.5);
    finalText.setScrollFactor(0);
    finalText.setDepth(2000);
    finalText.setScale(0);

    this.tweens.add({
      targets: finalText,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: "Back.easeOut",
    });

    // Restore time and fade out
    this.time.delayedCall(300, () => {
      if (this._destroyed) return;
      if (this.physics?.world) {
        this.physics.world.timeScale = 1;
      }
    });

    // Fade out and emit score after delay
    this.time.delayedCall(1200, () => {
      if (this._destroyed) return;
      this.cameras.main.fadeOut(400);
    });

    this.time.delayedCall(2000, () => {
      if (this._destroyed) return;
      // Stop UIScene
      if (this.scene.isActive("UIScene")) {
        this.scene.stop("UIScene");
      }
      EventBus.emit("round-complete", {
        score: this.score,
        playerId: this.playerId,
        round: this.round,
      });
    });
  }

  protected onRemotePlayersUpdated(remotePlayers: RemotePlayerState[]): void {
    if (this._destroyed || !this.sys || !this.scene || !this.add) return;

    const activeIds = new Set<string>();

    for (const rp of remotePlayers) {
      activeIds.add(rp.playerId);

      let container = this.remoteSpriteMap.get(rp.playerId);
      if (!container) {
        // Scene may have been destroyed mid-loop
        if (this._destroyed || !this.sys || !this.add) return;

        // Create remote player sprite
        let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
        if (this._useAIPlayerSprite && this.textures.exists("player_template")) {
          sprite = this.add.sprite(0, 0, "player_template");
          sprite.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE);
          sprite.setTint(Phaser.Display.Color.HexStringToColor(rp.color).color);
        } else {
          const spriteKey = `player_${rp.playerId}`;
          const hasTexture = this.textures.exists(spriteKey);
          sprite = hasTexture
            ? this.add.sprite(0, 0, spriteKey)
            : this.add.rectangle(0, 0, PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE, Phaser.Display.Color.HexStringToColor(rp.color).color);
          if (sprite instanceof Phaser.GameObjects.Sprite) {
            sprite.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE);
          }
        }
        sprite.setAlpha(0.7);

        const remoteNameTagY = -(PLAYER_DISPLAY_SIZE / 2 + 6);
        const label = this.add.text(0, remoteNameTagY, rp.playerName, {
          fontSize: "9px",
          fontFamily: "monospace",
          color: "#cccccc",
          backgroundColor: "#00000066",
          padding: { x: 2, y: 1 },
        });
        label.setOrigin(0.5);

        container = this.add.container(rp.x, rp.y, [sprite, label]);
        container.setDepth(50);
        this.remoteSpriteMap.set(rp.playerId, container);
      }
    }

    // Remove disconnected players
    for (const [id, container] of this.remoteSpriteMap) {
      if (!activeIds.has(id)) {
        container.destroy(true);
        this.remoteSpriteMap.delete(id);
      }
    }
  }

  update(time: number, delta: number): void {
    if (this._destroyed || !this.roundActive) return;

    // Landing detection for juice + audio
    if (this.playerBody) {
      const onGround = this.playerBody.touching.down || this.playerBody.blocked.down;
      if (onGround && !this._wasOnGround && this.playerBody.velocity.y >= 0) {
        this.juice?.landingImpact(this.player);
        this.audio?.playSFX("land");
      }
      this._wasOnGround = onGround;

      // Coyote time tracking
      if (onGround) {
        this._coyoteTimer = BaseScene.COYOTE_TIME;
      } else if (this._coyoteTimer > 0) {
        this._coyoteTimer -= delta;
      }

      // Jump buffer tracking
      if (this._jumpBufferTimer > 0) {
        this._jumpBufferTimer -= delta;
      }
    }

    // Procedural animation
    if (this.animator && this.playerBody) {
      const animState = this.animator.detectState(this.playerBody);
      this.animator.setState(animState);
      this.animator.update(delta);
    }

    // Interpolate remote players
    const remotes = this.multiplayer.interpolate(delta);
    for (const rp of remotes) {
      const container = this.remoteSpriteMap.get(rp.playerId);
      if (container) {
        container.x = rp.x;
        container.y = rp.y;
      }
    }

    // Send local position
    this.multiplayer.sendPosition(
      this.player.x,
      this.player.y,
      this.playerBody.velocity.x,
      this.playerBody.velocity.y,
      this.getPlayerAnimation()
    );
  }

  /**
   * Combined coyote time + jump buffer + landing detection + SFX.
   * Call from PlatformerScene, RunnerScene, ClimberScene instead of inline jump checks.
   */
  protected updatePlatformerPhysics(jumpForce: number): boolean {
    const onGround = this.playerBody.touching.down || this.playerBody.blocked.down;
    const wantsJump = this.isUpDown() || this.isActionDown();

    if (wantsJump) {
      this._jumpBufferTimer = BaseScene.JUMP_BUFFER_TIME;
    }

    const canJump =
      (onGround || this._coyoteTimer > 0) && this._jumpBufferTimer > 0;

    if (canJump) {
      this.playerBody.setVelocityY(-jumpForce);
      this._coyoteTimer = 0;
      this._jumpBufferTimer = 0;
      this.audio?.playSFX("jump");
      return true;
    }
    return false;
  }

  protected getPlayerAnimation(): string {
    const onGround = this.playerBody.touching.down || this.playerBody.blocked.down;
    if (!onGround && this.playerBody.velocity.y < 0) return "jump";
    if (!onGround && this.playerBody.velocity.y > 0) return "fall";
    if (Math.abs(this.playerBody.velocity.x) > 10) return "run";
    return "idle";
  }

  protected isLeftDown(): boolean {
    return (
      this.cursors?.left?.isDown ||
      this.wasd?.A?.isDown ||
      this.mobileControls?.getState().left ||
      false
    );
  }

  protected isRightDown(): boolean {
    return (
      this.cursors?.right?.isDown ||
      this.wasd?.D?.isDown ||
      this.mobileControls?.getState().right ||
      false
    );
  }

  protected isUpDown(): boolean {
    return (
      this.cursors?.up?.isDown ||
      this.wasd?.W?.isDown ||
      this.mobileControls?.getState().up ||
      false
    );
  }

  protected isDownKeyDown(): boolean {
    return (
      this.cursors?.down?.isDown ||
      this.wasd?.S?.isDown ||
      this.mobileControls?.getState().down ||
      false
    );
  }

  protected isActionDown(): boolean {
    return (
      this.cursors?.space?.isDown ||
      this.mobileControls?.getState().action ||
      false
    );
  }

  private cleanupEventBus(): void {
    this._destroyed = true;
    if (this.boundOnRemotePlayersUpdated) {
      EventBus.off("remote-players-updated", this.boundOnRemotePlayersUpdated);
      this.boundOnRemotePlayersUpdated = null;
    }
  }

  shutdown(): void {
    this._destroyed = true;
    this.cleanupEventBus();
    this.multiplayer?.destroy();
    this.mobileControls?.destroy();
    this.juice?.destroy();
    this.audio?.destroy();
    this.remoteSpriteMap.clear();
  }
}
