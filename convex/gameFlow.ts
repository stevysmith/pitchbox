"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";
import { PNG } from "pngjs";

const HTML_GAME_SYSTEM_PROMPT = `You are the world's most creative HTML5 micro-game designer. You write ACTUAL GAME CODE — every round is a completely unique, self-contained HTML5 game. WarioWare-level variety: side-scrollers, sports, rhythm games, card games, physics puzzles, shooters, racing, anything.

Given a prompt, generate a party game with 5 unique micro-game rounds. Each round's "gameCode" is a complete HTML snippet that runs inside a sandboxed iframe with the PB SDK pre-loaded.

== PB SDK API (pre-loaded, always available) ==

LIFECYCLE:
PB.ready()                     // MUST call after setup — signals parent you're ready
PB.onStart(callback)           // Called when countdown finishes — start gameplay HERE
PB.onEnd(callback)             // Called when time runs out — cleanup here
PB.endGame(finalScore?)        // Signal game complete early (auto-called on timeout)

SCORING:
PB.setScore(n)                 // Set absolute score
PB.addScore(n)                 // Add to score (negative allowed, floor is 0)

DATA:
PB.player   { id, name, emoji, color, index }
PB.config   { timeLimit, difficulty, theme }
PB.sprites  { player?, collectible?, hazard?, background? }  // URLs from Imagen
PB.theme    { emoji, primaryColor, secondaryColor, accentColor }

CANVAS:
PB.createCanvas(w?, h?)        // Creates full-viewport canvas, returns { canvas, ctx, width, height }

INPUT (ONLY these methods exist — do NOT use scroll, wheel, mousewheel, or any other input):
PB.input    { left, right, up, down, action, pointerX, pointerY, pointerDown }
PB.input.onTap(cb)             // cb(x, y) — USE THIS for "tap to shoot/fire/jump" mechanics
PB.input.onSwipe(cb)           // cb(direction, distance) — direction: "left"|"right"|"up"|"down"

AUDIO:
PB.audio.beep() / .success() / .fail() / .collect() / .tick()
PB.audio.combo() / .milestone() / .countdown() / .timeWarning() / .whoosh()
Note: PB.audio.collect() pitch-shifts higher as combo increases (Katamari effect)

MUSIC (auto-plays, no setup needed):
PB.music auto-starts a procedural background track on PB.onStart based on theme mood.
PB.music.setIntensity(0-1)  // Ramp up as time runs out or action intensifies
PB.music.stop()             // Rarely needed — auto-stops on PB.onEnd

COMBO:
PB.combo.hit()              // Call on successful action — returns multiplier (1-5x)
PB.combo.miss()             // Call on failure — resets combo
PB.combo.current            // Current hit streak count
PB.combo.multiplier         // Current multiplier (1-5)
PB.combo.max                // Highest streak this round
// Auto-triggers celebrations at milestones: 5="NICE!", 10="AMAZING!", 15="LEGENDARY!", 25="GODLIKE!"

TIMING:
PB.delta()                     // Returns seconds since last frame (use for frame-rate independent movement)
PB.paused                      // true when tab is hidden — skip updates when paused!

JUICE (game-feel effects — USE THESE for polish!):
PB.shake(magnitude?, decay?)   // Screen shake. Apply PB.shakeX, PB.shakeY to your draw offset.
PB.particles(x, y, {count, color, speed, life, size})  // Burst particles at position
PB.float(text, x, y, {color, size, vy, life})          // Floating text ("+10", "NICE!")
PB.flash(color?, duration?)                             // Full-screen flash
PB.drawTimer(ctx, timeLeft, totalTime, canvasWidth)     // Built-in timer bar
PB.updateJuice()               // Call once per frame BEFORE drawing
PB.drawJuice(ctx, W, H)       // Call AFTER scene render to draw particles/floaters/flash

COLLISION:
PB.rectCollide({x,y,w,h}, {x,y,w,h})   // AABB box collision
PB.circleCollide(x1,y1,r1, x2,y2,r2)   // Circle collision

EASING: PB.easeOutBounce(t) / .easeOutElastic(t) / .easeOutCubic(t) / .easeInOutQuad(t)

DRAWING:
PB.text(ctx, text, x, y, {size, color, align, outline, outlineWidth})
PB.emoji(ctx, emoji, x, y, size)
PB.roundRect(ctx, x, y, w, h, radius)  // Creates path, call fill()/stroke()

MATH:
PB.random(min,max) / .randomInt(min,max) / .lerp(a,b,t) / .distance(x1,y1,x2,y2) / .clamp(val,min,max)
PB.loadImage(url)              // Returns Promise<Image> — for Imagen sprites

== MANDATORY GAME SKELETON (your code MUST follow this structure exactly) ==
<script>(function(){
  var W, H, ctx;
  // === YOUR GAME STATE HERE ===

  function init() {
    var c = PB.createCanvas(); ctx = c.ctx; W = c.width; H = c.height;
    // === YOUR SETUP HERE (create objects, register input handlers) ===
    PB.onStart(function() { requestAnimationFrame(loop); });
    PB.onEnd(function() { /* cleanup */ });
    PB.ready();
  }

  function update(dt) {
    // === YOUR GAME LOGIC HERE (input, physics, collisions, scoring) ===
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(PB.shakeX, PB.shakeY);
    // === YOUR DRAWING HERE ===
    ctx.restore();
    PB.drawJuice(ctx, W, H);
  }

  function loop() {
    if (PB.paused) { requestAnimationFrame(loop); return; }
    var dt = PB.delta();
    PB.updateJuice();
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  init();
})();</script>

CRITICAL SKELETON RULES:
- requestAnimationFrame(loop) is called UNCONDITIONALLY (even when paused, so the loop never breaks)
- PB.paused check is an early-return BEFORE update/draw, but AFTER scheduling next frame
- update() and draw() are SEPARATE functions — put game logic in update(), rendering in draw()
- PB.updateJuice() is called BEFORE update() in the loop
- PB.drawJuice(ctx, W, H) is called AFTER ctx.restore() in draw()
- PB.ready() is called AFTER PB.onStart() registration
- Game loop starts inside PB.onStart callback via requestAnimationFrame(loop)

SAFETY RULES (prevent crashes):
- ALWAYS check array length before accessing elements: if (arr.length > 0) arr[0].x
- NEVER access arr[index] without checking: if (i < arr.length && arr[i]) arr[i].x
- Use for loops from length-1 to 0 when splicing: for (var i = arr.length-1; i >= 0; i--)
- NEVER use array.filter()[0].property — the filter result may be empty
- ALWAYS initialize all object properties when pushing to arrays — never leave x/y/w/h undefined
- Guard touch/pointer access: var t = e.touches ? e.touches[0] : e; if (!t) return;
- Every spawned object MUST have all properties set at creation time (x, y, speed, etc.)
- NEVER use scroll, wheel, mousewheel, or keyboard-only controls. Players are on phones. Use ONLY: PB.input.onTap, PB.input.onSwipe, PB.input.pointerDown/pointerX/pointerY, or PB.input arrow keys + action

== EXAMPLE: Catch Game (filled-in skeleton) ==
<script>(function(){
  var W, H, ctx, playerX, items = [], elapsed = 0;
  var playerW = 60, playerH = 20, spawnCD = 0;

  function init() {
    var c = PB.createCanvas(); ctx = c.ctx; W = c.width; H = c.height;
    playerX = W / 2;
    PB.onStart(function() { requestAnimationFrame(loop); });
    PB.onEnd(function() {});
    PB.ready();
  }

  function update(dt) {
    elapsed += dt; spawnCD -= dt;
    if (PB.input.pointerDown) playerX = PB.lerp(playerX, PB.input.pointerX, 0.15);
    else if (PB.input.left) playerX -= 6;
    else if (PB.input.right) playerX += 6;
    playerX = PB.clamp(playerX, playerW/2, W-playerW/2);
    PB.music.setIntensity(elapsed / PB.config.timeLimit);
    if (spawnCD <= 0 && items.length < 50) {
      items.push({ x: PB.random(20,W-20), y: -10, speed: PB.random(2,4+PB.config.difficulty), good: Math.random()>0.3, r: PB.random(6,12) });
      spawnCD = 0.1;
    }
    for (var i = items.length-1; i >= 0; i--) {
      items[i].y += items[i].speed;
      if (items[i].y > H-45 && Math.abs(items[i].x-playerX) < playerW) {
        if (items[i].good) {
          var mult = PB.combo.hit(); var pts = 10*mult;
          PB.addScore(pts); PB.audio.collect();
          PB.particles(items[i].x, items[i].y, {color:PB.theme.accentColor, count:6});
          PB.float("+"+pts, items[i].x, items[i].y-10, {color:PB.theme.accentColor});
        } else {
          PB.combo.miss(); PB.addScore(-5); PB.audio.fail();
          PB.shake(6); PB.flash("#ef4444", 8);
          PB.float("-5", items[i].x, items[i].y-10, {color:"#ef4444"});
        }
        items.splice(i,1);
      } else if (items[i].y > H+20) items.splice(i,1);
    }
  }

  function draw() {
    ctx.save(); ctx.translate(PB.shakeX, PB.shakeY);
    ctx.fillStyle = PB.theme.primaryColor; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = PB.player.color;
    PB.roundRect(ctx, playerX-playerW/2, H-42, playerW, playerH, 6); ctx.fill();
    for (var j = 0; j < items.length; j++) {
      ctx.fillStyle = items[j].good ? PB.theme.accentColor : "#ef4444";
      ctx.beginPath(); ctx.arc(items[j].x, items[j].y, items[j].r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    PB.drawJuice(ctx, W, H);
    PB.drawTimer(ctx, PB.config.timeLimit - elapsed, PB.config.timeLimit, W);
  }

  function loop() {
    if (PB.paused) { requestAnimationFrame(loop); return; }
    var dt = PB.delta();
    PB.updateJuice();
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  init();
})();</script>

== MANDATORY RULES ==
1. Each round's gameCode is a <script>(function(){...})();</script> block — IIFE, always.
2. NO CDN imports, NO external libraries. Pure Canvas2D/JS only.
3. Mobile-first: use PB.input for touch+keyboard. Pointer-based controls preferred.
4. Call PB.ready() at end of init. Register PB.onStart() to begin gameplay. Register PB.onEnd().
5. Use PB.addScore/setScore during play. PB.endGame() or time-up auto-submits.
6. 80-250 lines per game. Keep it tight and fun.
7. Use PB.audio for juice (collect, fail, success, beep, tick) — at LEAST 2 sound effects.
8. Use PB.sprites.player etc. with PB.loadImage() for themed visuals when available.
9. Difficulty escalation: round 1 = easy/gentle, round 5 = chaotic/hard. Vary speed, spawn rate, complexity.
10. MAXIMUM VARIETY — never repeat the same game genre across 5 rounds. Each round completely different.

== QUALITY GUARDRAILS (CRITICAL) ==
Q1. GAME LOOP: Always use requestAnimationFrame. Never use setInterval for game loops.
Q2. DELTA TIME: Use var dt = PB.delta() each frame for frame-rate independent timing. Track elapsed += dt.
Q3. JUICE IS MANDATORY: Every game MUST use at least:
    - PB.particles() on positive events (collect, score, win)
    - PB.shake() on negative events (hit, damage, fail)
    - PB.float() to show score changes ("+10", "-5")
    - PB.audio.collect() and PB.audio.fail() at minimum
    - PB.combo.hit() on each successful action for combo tracking (SDK handles milestones automatically)
Q4. SCREEN SHAKE: Wrap drawing in ctx.save(); ctx.translate(PB.shakeX, PB.shakeY); ... ctx.restore();
    Then call PB.drawJuice(ctx, W, H) AFTER ctx.restore() so juice renders without shake.
Q5. TIMER BAR: Call PB.drawTimer(ctx, timeLeft, totalTime, W) for visual urgency.
Q6. SCORING — COMBOS & VARIETY:
    - Use PB.combo.hit() on every successful action — it returns a multiplier (1x-5x)
    - Multiply point rewards by the combo multiplier: PB.addScore(10 * PB.combo.hit());
    - Call PB.combo.miss() on failures to reset the combo
    - The SDK auto-triggers celebrations at combo milestones (5, 10, 15, 25 hits)
    - Base positive actions: +5 to +25 points (proportional to difficulty)
    - Penalties: -5 to -15 (never more than 60% of a reward)
    - Total achievable score per round: 100-500 range
    - Score should feel earnable — player should get 50+ if they're trying
    - Include risk-reward zones: harder-to-reach targets worth 2-3x normal points
    - Near-miss bonus: award +5 for narrowly dodging hazards (check distance < hazardRadius + 10)
    - Time bonus: 2x scoring in first 10 seconds to reward fast starts
Q7. BOUNDS CHECK: Always clamp player position to canvas. Items off-screen must be removed.
Q8. OBJECT CLEANUP: Splice/remove objects that exit canvas. Never let arrays grow unbounded.
Q9. COLLISION: Use PB.rectCollide() or PB.circleCollide() — don't hand-roll broken collision.
Q10. VISUALS — THEME COLOR ENFORCEMENT:
    - Background: ALWAYS use PB.theme.primaryColor (not hardcoded #1a1a2e or #0f172a)
    - Player: ALWAYS use PB.player.color for the player character
    - Collectibles: ALWAYS use PB.theme.accentColor for positive items
    - Hazards: Use "#ef4444" (red) for dangers
    - UI/decorations: Use PB.theme.secondaryColor
    - NO hardcoded colors for primary game elements — every game should look unique to its theme
Q11. PAUSE: Check "if (PB.paused) return;" at top of game loop — game pauses when tab is hidden.
     Use PB.roundRect for shapes, PB.emoji for themed elements.

== PERFORMANCE BUDGET (CRITICAL — prevents death spirals) ==
P1. MAX 50 active entities on screen at any time. Before spawning, check array.length.
P2. MAX 12 particles per burst (PB.particles count param). MAX 80 particles on screen total.
P3. At difficulty 5, cap spawn rate to maximum 1 new entity per 0.3 seconds. Use a spawnCooldown timer.
P4. FPS-AWARE THROTTLING: Track frame times. If dt > 0.033 (below 30fps) for 3+ consecutive frames,
    STOP spawning new entities until dt recovers below 0.025 for 2+ frames. Example:
    var slowFrames = 0;
    // in loop:
    if (dt > 0.033) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    var canSpawn = slowFrames < 3 && items.length < 50;
P5. Always splice from end of array (for-loop from length-1 to 0) when removing items.
P6. Round 5 should be HARD but never UNPLAYABLE. The challenge is precision, not overwhelm.

== COMBO EXAMPLE ==
// In your game loop, when player collects something:
var mult = PB.combo.hit();  // Returns 1-5 based on streak
var pts = 10 * mult;
PB.addScore(pts);
PB.audio.collect();
PB.float("+" + pts, x, y, {color: PB.theme.accentColor});
// SDK auto-shows "NICE!" at 5 hits, "AMAZING!" at 10, "LEGENDARY!" at 15

// When player gets hit or misses:
PB.combo.miss();
PB.addScore(-5);
PB.audio.fail();
PB.shake(6);

== COLLABORATIVE SCORING ==
- Frame rounds as team challenges: "Your squad needs you!"
- Round descriptions should address the group: "Help your crew dodge the chaos!"
- The SDK tracks team totals — high combined scores unlock flavor text celebrations
- Even losing players contribute to the team energy

== BAD GAME ANTI-PATTERNS (NEVER make these) ==
BAD 1: "TAP SIMULATOR" — Just a button that gives +1 per tap. No skill, no variety, boring.
BAD 2: "SPAWN APOCALYPSE" — 200 objects spawning at difficulty 5, drops to 5fps, unplayable.
BAD 3: "BINARY SCORER" — Only two outcomes: +100 or 0. No granularity, no progression feeling.
BAD 4: "SILENT VOID" — No PB.audio calls, no PB.particles, no PB.float. Feels dead and lifeless.
BAD 5: "DODGE-ONLY" — Player just avoids things, never collects or scores positively. Feels punishing.
BAD 6: "IMPOSSIBLE ROUND 5" — Difficulty so high no human can score above 0. Frustrating, not fun.
BAD 7: "IDENTICAL TWINS" — Two rounds with the same mechanic (e.g., both are catch games with different skins).

== HUMOR & PERSONALITY ==
- Round titles should be PUNNY or ABSURD: "Dodge the Responsibilities", "Catch These Vibes", "Speed Run Your Taxes"
- Descriptions should have GEN-Z ENERGY: "this is giving chaos energy", "no cap this round goes hard"
- Reference the user's prompt in weird/funny ways for taglines and round names
- Float text can be funny: "SHEESH!", "BUSSIN!", "RIP BOZO" on fail
- The overall game should make people LAUGH — humor is the #1 driver of party game virality

== ANTI-PATTERNS TO AVOID ==
- NEVER forget PB.ready() — game won't start without it
- NEVER start the game loop outside PB.onStart() — countdown won't work
- NEVER use setInterval for game loop (jank, drift, can't pause)
- NEVER spawn objects infinitely without removing them (memory leak, slowdown)
- NEVER make the game impossible — even round 5 should be winnable
- NEVER use alert/confirm/prompt — they're blocked in sandbox
- NEVER reference DOM elements other than the canvas
- NEVER use Math.random() for positions without clamping to canvas bounds
- NEVER make a game that gives 0 points if the player is actively trying
- NEVER use hardcoded colors like #1a1a2e — use PB.theme.primaryColor instead
- NEVER forget PB.combo.hit()/miss() — combos are the core engagement loop
- NEVER spawn more than 50 entities — check array.length before spawning

== GENRE CATEGORIES (use 3+ different categories across 5 rounds!) ==
PRECISION: Golf/aiming, slingshot launcher, target shooting gallery, bouncing ball aim, trail drawing
RHYTHM: Tap-timing rhythm, simon says, pie slice timing, gear matching, pattern recognition
REFLEXES: Whack-a-mole, fruit ninja swipe, reaction time test, bubble pop, light switch puzzle
STRATEGY: Tower stacking, tetris-style fitting, conveyor belt sorting, color sorting, card matching
SURVIVAL: Side-scroller runner, asteroid dodge, dodge game, flappy-style, shield defense
CHAOS: Catch/dodge falling, space invaders, tug-of-war tapping, lane-switch racing, orbit/gravity
CREATIVE: Path drawing, connect-the-dots, marble roll, memory sequence, word scramble

ROUND PACING (follow this arc for 5 rounds):
- Round 1: WARMUP — Simple, approachable, teach the vibe (difficulty 1-2)
- Round 2: TWIST — Introduce a new mechanic type, moderate challenge (difficulty 2-3)
- Round 3: CHALLENGE — Ramp up, use a skill-based genre (difficulty 3-4)
- Round 4: WILDCARD — Most creative/unusual genre, surprise factor (difficulty 3-4)
- Round 5: FINALE — Hardest but fair, high stakes, chaotic energy (difficulty 4-5)
MANDATE: Use at least 3 different genre CATEGORIES across the 5 rounds. Never repeat a category back-to-back.

RESPOND WITH ONLY VALID JSON:
{
  "title": "Game Title (2-4 words)",
  "tagline": "One funny line",
  "artStyle": "modern",
  "theme": {
    "emoji": "one emoji",
    "primaryColor": "#hex (dark, e.g. #1a1a2e)",
    "secondaryColor": "#hex (accent)",
    "accentColor": "#hex (bright highlight)",
    "mood": "silly|competitive|creative|chill|chaotic|spicy|wholesome"
  },
  "settings": { "minPlayers": 2, "maxPlayers": 20 },
  "spritePrompts": {
    "player": "cartoon [themed character] with bold black outlines, simple shapes, expressive, solid white background, centered, isolated, full body",
    "collectible": "cartoon [themed collectible item] with bold black outlines, shiny, solid white background, centered, isolated",
    "hazard": "cartoon [themed danger] with bold black outlines, threatening, solid white background, centered, isolated",
    "background": "vibrant cartoon [themed environment], colorful, wide landscape, game background, atmospheric"
  },
  "rounds": [
    {
      "title": "Punchy Round Title",
      "description": "Short instruction (1 sentence, Gen-Z energy)",
      "type": "html-game",
      "timeLimit": 25,
      "gameCode": "<script>(function(){...complete game code...})();</script>"
    }
  ]
}

SPRITE PROMPT GUIDELINES:
- Use MODERN CARTOON / VECTOR ILLUSTRATION style. Think Among Us, Fall Guys — NOT pixel art.
- "player": A themed CHARACTER. Bold outlines, expressive.
- "collectible": A themed ITEM. Shiny, appealing.
- "hazard": A themed DANGER. Threatening.
- "background": A scenic ENVIRONMENT. Wide, atmospheric.

FINAL CHECKLIST (verify each game mentally):
[x] PB.ready() called at end of init
[x] Game loop starts only inside PB.onStart callback
[x] requestAnimationFrame used (not setInterval)
[x] PB.delta() used for timing, not hardcoded 1/60
[x] PB.paused check at top of game loop
[x] Scoring works and gives points for player actions
[x] At least 2 audio calls (PB.audio.collect, PB.audio.fail, etc.)
[x] PB.particles/shake/float used for juice
[x] PB.updateJuice + PB.drawJuice called in loop
[x] Screen shake translate applied (ctx.save/translate/restore pattern)
[x] Objects cleaned up when off-screen
[x] Player position clamped to canvas
[x] Fun for 20-30 seconds, scoring feels rewarding
[x] Themed to the user's prompt

NO markdown, NO explanation, ONLY the JSON object.`;

/**
 * Validate and auto-repair AI-generated gameCode.
 * Catches common issues before games reach players.
 */
function validateGameCode(gameCode: string): { valid: boolean; issues: string[]; repaired: boolean; code: string } {
  const issues: string[] = [];
  let code = gameCode.trim();
  let repaired = false;

  if (!code.startsWith("<script>")) {
    code = `<script>${code}</script>`;
    issues.push("REPAIRED: Added missing <script> tags");
    repaired = true;
  }

  const inner = code.replace(/^<script>/, "").replace(/<\/script>$/, "");

  if (!inner.includes("PB.ready")) {
    issues.push("CRITICAL: Missing PB.ready() — game will never start");
  }
  if (!inner.includes("PB.onStart")) {
    issues.push("CRITICAL: Missing PB.onStart() — game loop won't begin");
  }
  if (!inner.includes("requestAnimationFrame") && !inner.includes("setInterval") && !inner.includes("setTimeout")) {
    issues.push("CRITICAL: No game loop detected");
  }
  if (!inner.includes("PB.addScore") && !inner.includes("PB.setScore")) {
    issues.push("WARNING: No scoring calls");
  }
  if (inner.includes("alert(") || inner.includes("confirm(") || inner.includes("prompt(")) {
    code = code.replace(/alert\([^)]*\)/g, "/* blocked */").replace(/confirm\([^)]*\)/g, "true").replace(/prompt\([^)]*\)/g, '""');
    repaired = true;
    issues.push("REPAIRED: Removed alert/confirm/prompt");
  }

  const hasCritical = issues.some((i) => i.startsWith("CRITICAL"));
  return { valid: !hasCritical, issues, repaired, code };
}

interface SpritePrompts {
  player?: string;
  collectible?: string;
  hazard?: string;
  background?: string;
  ground?: string;
  platform?: string;
}

interface SpriteImages {
  player?: string;
  collectible?: string;
  hazard?: string;
  background?: string;
  ground?: string;
  platform?: string;
}

/**
 * Remove white/near-white background from a sprite PNG.
 * Same pattern as wildgoose-server's rembg pipeline:
 * generate with solid white bg → remove bg via pixel processing.
 * Background images are returned as-is (no removal needed).
 */
function removeWhiteBackground(pngBuffer: Buffer, key: string): Buffer {
  if (key === "background") {
    return pngBuffer; // Backgrounds keep their content as-is
  }

  const png = PNG.sync.read(pngBuffer);
  const HARD = 248; // Definitely white → fully transparent
  const SOFT = 220; // Edge zone → gradual fade for anti-aliasing

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) * 4;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      const minChannel = Math.min(r, g, b);

      if (minChannel > HARD) {
        // Pure white — fully transparent
        png.data[idx + 3] = 0;
      } else if (minChannel > SOFT) {
        // Near-white edge — gradual transparency
        const alpha = Math.round(((HARD - minChannel) / (HARD - SOFT)) * 255);
        png.data[idx + 3] = Math.min(png.data[idx + 3], alpha);
      }
    }
  }

  return PNG.sync.write(png);
}

async function generateSpriteImages(
  spritePrompts: SpritePrompts,
  storage: { store(blob: Blob): Promise<any>; getUrl(id: any): Promise<string | null> },
  partialResults?: SpriteImages
): Promise<SpriteImages> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    console.log("[Sprites] No GOOGLE_GEMINI_API_KEY set, skipping sprite generation");
    return {};
  }

  console.log("[Sprites] Generating images for:", Object.keys(spritePrompts));
  const ai = new GoogleGenAI({ apiKey });
  const result: SpriteImages = partialResults || {};

  const entries = Object.entries(spritePrompts).filter(
    ([, prompt]) => prompt && typeof prompt === "string"
  ) as [keyof SpriteImages, string][];

  const settled = await Promise.allSettled(
    entries.map(async ([key, prompt]) => {
      console.log(`[Sprites] Generating ${key}: "${prompt.slice(0, 80)}..."`);
      const response = await ai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/png",
        },
      });

      const imageData = response.generatedImages?.[0]?.image?.imageBytes;
      if (imageData) {
        const rawKB = Math.round(imageData.length / 1024);
        console.log(`[Sprites] ${key} generated (${rawKB}KB), processing...`);

        // Remove white background from sprites (backgrounds kept as-is)
        const rawBuffer = Buffer.from(imageData, "base64");
        const processed = removeWhiteBackground(rawBuffer, key);
        const processedKB = Math.round(processed.length / 1024);
        console.log(`[Sprites] ${key} processed: ${rawKB}KB → ${processedKB}KB`);

        // Store in Convex file storage
        const blob = new Blob([new Uint8Array(processed)], { type: "image/png" });
        const storageId = await storage.store(blob);
        const url = await storage.getUrl(storageId);
        if (url) {
          console.log(`[Sprites] ${key} stored at ${url.slice(0, 80)}...`);
          // Write immediately so partial results survive timeout
          result[key] = url;
          return { key, url };
        }
        console.log(`[Sprites] ${key} stored but getUrl returned null`);
        return null;
      }
      console.log(`[Sprites] ${key} returned no image data`);
      return null;
    })
  );

  for (const item of settled) {
    if (item.status === "fulfilled" && item.value) {
      result[item.value.key] = item.value.url;
    } else if (item.status === "rejected") {
      console.error(`[Sprites] Generation failed:`, item.reason);
    }
  }

  console.log(`[Sprites] Generated ${Object.keys(result).length}/${entries.length} sprites`);
  return result;
}

export const generateAndCreateGame = action({
  args: {
    prompt: v.string(),
    hostName: v.string(),
    hostEmoji: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { prompt, hostName, hostEmoji, sessionId }): Promise<{ code: string; gameId: string; roomId: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    // Generate game with Claude
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 16384,
        messages: [
          {
            role: "user",
            content: `Create a party game with 5 unique HTML5 micro-games based on this prompt: "${prompt}"`,
          },
        ],
        system: HTML_GAME_SYSTEM_PROMPT,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI generation failed: ${error}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    if (!content) throw new Error("No content generated");

    // Parse the JSON response
    let gameDefinition: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      gameDefinition = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`Failed to parse game definition: ${e}`);
    }

    // Validate basic structure
    if (!gameDefinition.title || !gameDefinition.rounds?.length) {
      throw new Error("Invalid game definition structure");
    }

    // Validate rounds: html-game needs gameCode, otherwise fallback to phaser-game
    const sceneTypeFallbacks = ["runner", "arena", "platformer", "dodge", "shooter", "catcher", "climber", "memory"];
    const roundsNeedingRepair: { index: number; issues: string[] }[] = [];

    for (let i = 0; i < gameDefinition.rounds.length; i++) {
      const round = gameDefinition.rounds[i];

      if (round.type === "html-game" && round.gameCode && round.gameCode.length >= 80) {
        // Validate & auto-repair the game code
        const validation = validateGameCode(round.gameCode);
        if (validation.repaired) {
          round.gameCode = validation.code;
          console.log(`[Game] Round ${i} auto-repaired: ${validation.issues.filter(i => i.startsWith("REPAIRED")).join(", ")}`);
        }
        if (validation.issues.length > 0) {
          console.log(`[Game] Round ${i} validation: ${validation.issues.join(" | ")}`);
        }
        // Queue for repair if has CRITICAL issues or multiple WARNING issues
        const criticalIssues = validation.issues.filter(i => i.startsWith("CRITICAL"));
        const warningIssues = validation.issues.filter(i => i.startsWith("WARNING"));
        if (criticalIssues.length > 0 || warningIssues.length >= 2) {
          const repairIssues = [...criticalIssues, ...warningIssues];
          roundsNeedingRepair.push({ index: i, issues: repairIssues });
          console.log(`[Game] Round ${i} has ${criticalIssues.length} CRITICAL + ${warningIssues.length} WARNING issues, queuing for targeted repair`);
        }
        round.config = round.config || {};
        continue;
      }

      // Fallback to phaser-game if gameCode is missing/short or type isn't html-game
      console.log(`[Game] Round ${i} missing/invalid gameCode, falling back to phaser-game`);
      round.type = "phaser-game";
      delete round.gameCode;
      round.config = round.config || {};
      round.config.sceneType = round.config.sceneType || sceneTypeFallbacks[i % sceneTypeFallbacks.length];
      round.config.difficulty = round.config.difficulty || Math.min(i + 1, 5);
      round.config.timeLimit = round.timeLimit || 30;
      round.config.tilemap = round.config.tilemap || [];
      round.config.entities = round.config.entities || [];
      round.config.scoring = round.config.scoring || {
        collectiblePoints: 10,
        survivalBonusPerSecond: 2,
        completionBonus: 50,
        speedBonusMultiplier: 3,
      };
      round.config.colors = round.config.colors || {
        sky: "#1a1a2e",
        ground: "#4a7c59",
        platform: "#8b6914",
        hazard: "#ff4444",
        collectible: "#ffd700",
        player: "#3498db",
      };
      round.config.physics = round.config.physics || {
        gravity: 600,
        playerSpeed: 200,
        jumpForce: 400,
        scrollSpeed: 120,
      };
    }

    // Targeted repair: fix rounds with CRITICAL issues via a cheap Claude call
    if (roundsNeedingRepair.length > 0) {
      console.log(`[Game] Attempting targeted repair for ${roundsNeedingRepair.length} round(s)`);
      const repairResults = await Promise.allSettled(
        roundsNeedingRepair.map(async ({ index, issues }) => {
          const round = gameDefinition.rounds[index];
          try {
            const repairResponse = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-5-20250929",
                max_tokens: 4096,
                system: `You fix broken HTML5 Canvas games that use the PB SDK. Return ONLY the fixed <script>(function(){...})();</script> code block. No explanation, no markdown.

The game MUST follow this exact loop structure:
function loop() {
  if (PB.paused) { requestAnimationFrame(loop); return; }
  var dt = PB.delta();
  PB.updateJuice();
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

Required calls: PB.ready(), PB.onStart(), PB.createCanvas(), requestAnimationFrame(loop), PB.updateJuice(), PB.drawJuice(ctx, W, H).

COMMON FIXES:
- .filter()[0].property crashes if filter returns empty → use: var arr = x.filter(...); if (arr.length) arr[0].x
- Always check array.length > 0 before accessing array[index]
- Always initialize ALL object properties when pushing: {x:0, y:0, w:10, h:10, speed:1}
- Splice arrays from end: for (var i=arr.length-1; i>=0; i--) if splicing inside
- Guard PB.input access: use PB.input.pointerX (already canvas-relative)
- The game MUST score points when the player taps/clicks — ensure PB.addScore is called on user interaction
- The game MUST have visible game objects beyond just the background fill`,
                messages: [
                  {
                    role: "user",
                    content: `Fix this broken game code. Issues found: ${issues.join("; ")}\n\nBroken code:\n${round.gameCode}`,
                  },
                ],
              }),
            });

            if (!repairResponse.ok) {
              console.log(`[Game] Repair API failed for round ${index}: ${repairResponse.status}`);
              return null;
            }

            const repairData = await repairResponse.json();
            const repairContent = repairData.content?.[0]?.text;
            if (!repairContent) return null;

            // Extract the script block
            const scriptMatch = repairContent.match(/<script>[\s\S]*<\/script>/);
            if (!scriptMatch) return null;

            const repairedCode = scriptMatch[0];
            // Re-validate the repaired code
            const revalidation = validateGameCode(repairedCode);
            if (revalidation.valid) {
              round.gameCode = revalidation.code;
              console.log(`[Game] Round ${index} successfully repaired`);
              return index;
            } else {
              console.log(`[Game] Round ${index} repair still invalid: ${revalidation.issues.join(" | ")}`);
              return null;
            }
          } catch (e) {
            console.error(`[Game] Round ${index} repair error:`, e);
            return null;
          }
        })
      );

      // Fall back to phaser-game for rounds that couldn't be repaired
      for (const result of repairResults) {
        if (result.status === "rejected" || result.value === null) {
          // Find the round index from the repair queue
          const failedIndex = roundsNeedingRepair.find((r, i) => {
            if (result.status === "fulfilled" && result.value === null) return true;
            return result.status === "rejected";
          })?.index;
          if (failedIndex !== undefined) {
            const round = gameDefinition.rounds[failedIndex];
            // Only fall back if repair actually failed and the round is still invalid
            const recheck = validateGameCode(round.gameCode || "");
            if (!recheck.valid) {
              console.log(`[Game] Round ${failedIndex} repair failed, falling back to phaser-game`);
              round.type = "phaser-game";
              delete round.gameCode;
              round.config = round.config || {};
              round.config.sceneType = sceneTypeFallbacks[failedIndex % sceneTypeFallbacks.length];
              round.config.difficulty = round.config.difficulty || Math.min(failedIndex + 1, 5);
              round.config.timeLimit = round.timeLimit || 30;
            }
          }
        }
      }
    }

    // Cross-round diversity check
    {
      const types: string[] = [];
      for (const round of gameDefinition.rounds) {
        if (!round.gameCode) { types.push("unknown"); continue; }
        const code = round.gameCode.toLowerCase();
        if (code.includes("falling") || (code.includes(".y +=") && code.includes("splice"))) types.push("falling");
        else if (code.includes("runner") || (code.includes("jump") && code.includes("speed"))) types.push("runner");
        else if (code.includes("grid") || (code.includes("cols") && code.includes("rows"))) types.push("grid");
        else if (code.includes("ontap") || code.includes("whack")) types.push("tap");
        else if (code.includes("onswipe") || code.includes("swipe")) types.push("swipe");
        else if (code.includes("dodge") || code.includes("avoid")) types.push("dodge");
        else if (code.includes("shoot") || code.includes("bullet")) types.push("shooter");
        else types.push("other");
      }
      const distinct = new Set(types.filter(t => t !== "unknown"));
      if (distinct.size < 3 && gameDefinition.rounds.length >= 5) {
        console.log(`[Game] DIVERSITY WARNING: Only ${distinct.size} distinct game types across ${gameDefinition.rounds.length} rounds`);
      }
    }

    // Ensure artStyle defaults to "modern"
    gameDefinition.artStyle = gameDefinition.artStyle || "modern";

    // Build sprite prompts — use Claude's if present, otherwise derive from game theme
    const theme = gameDefinition.theme?.emoji || "";
    const title = gameDefinition.title || prompt;
    const roundTheme = gameDefinition.rounds?.[0]?.config?.theme || prompt;
    const claudePrompts: SpritePrompts = gameDefinition.spritePrompts || {};
    const spritePrompts: SpritePrompts = {
      player: claudePrompts.player || `cute cartoon ${title} character with bold black outlines, ${roundTheme}, simple shapes, expressive, solid white background, centered, isolated, full body`,
      collectible: claudePrompts.collectible || `cartoon collectible item for ${title} game with bold black outlines, ${roundTheme}, shiny, solid white background, centered, isolated`,
      hazard: claudePrompts.hazard || `cartoon danger for ${title} game with bold black outlines, ${roundTheme}, threatening, solid white background, centered, isolated`,
      background: claudePrompts.background || `vibrant cartoon ${roundTheme}, colorful, wide landscape, game background, atmospheric`,
    };

    // Ground/platform tiles use procedural generation (AI tiles are 1024x1024 but
    // display at 32x32 per tile — extreme downscaling destroys detail, so we skip them)
    let spriteImages: SpriteImages = {};

    console.log("[Game] spritePrompts:", Object.entries(spritePrompts).map(([k, v]) => `${k}: "${(v as string).slice(0, 60)}"`));

    try {
      // Use a shared object so partial results survive timeout
      const partialResults: SpriteImages = {};
      const generate = async () => {
        const result = await generateSpriteImages(spritePrompts, ctx.storage, partialResults);
        return result;
      };
      spriteImages = await Promise.race([
        generate(),
        new Promise<SpriteImages>((resolve) => {
          setTimeout(() => {
            console.log(`[Sprites] Timeout hit (25s), using ${Object.keys(partialResults).length} partial results`);
            resolve(partialResults);
          }, 25000);
        }),
      ]);
    } catch (e) {
      console.error("[Sprites] Gemini failed entirely:", e);
    }

    // Remove spritePrompts from definition (save space)
    delete gameDefinition.spritePrompts;

    // Add sprite images if any were generated
    if (Object.keys(spriteImages).length > 0) {
      gameDefinition.spriteImages = spriteImages;
      console.log("[Game] Attached spriteImages:", Object.keys(spriteImages));
    } else {
      console.log("[Game] No sprite images generated, using procedural fallback");
    }

    // Size safety: Convex docs have a 1MB limit
    // spriteImages now contain short URLs (not base64), so this rarely triggers
    const definitionJson = JSON.stringify(gameDefinition);

    // Generate room code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    // Create game in database
    const gameId = await ctx.runMutation(internal.games.create, {
      prompt,
      title: gameDefinition.title,
      tagline: gameDefinition.tagline || "",
      definition: definitionJson,
      themeEmoji: gameDefinition.theme?.emoji || "🎮",
      themeMood: gameDefinition.theme?.mood || "chaotic",
    });

    // Create room
    const roomId = await ctx.runMutation(internal.rooms.create, {
      gameId,
      code,
      hostSessionId: sessionId,
    });

    // Add host as first player
    await ctx.runMutation(internal.players.joinAsHost, {
      roomId,
      name: hostName,
      emoji: hostEmoji,
      sessionId,
    });

    return { code, gameId, roomId };
  },
});
