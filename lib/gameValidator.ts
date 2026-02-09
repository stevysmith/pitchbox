/**
 * Post-generation validation and auto-repair for AI-generated game code.
 * Catches common issues before games reach players.
 */

interface ValidationResult {
  valid: boolean;
  issues: string[];
  repaired: boolean;
  code: string;
}

/**
 * Validate and auto-repair AI-generated gameCode.
 * Returns the (possibly repaired) code and a list of issues found.
 */
export function validateGameCode(gameCode: string): ValidationResult {
  const issues: string[] = [];
  let code = gameCode.trim();
  let repaired = false;

  // Must be wrapped in <script> tags
  if (!code.startsWith("<script>")) {
    code = `<script>${code}</script>`;
    issues.push("REPAIRED: Added missing <script> tags");
    repaired = true;
  }

  const inner = code.replace(/^<script>/, "").replace(/<\/script>$/, "");

  // Critical: Must call PB.ready()
  if (!inner.includes("PB.ready()") && !inner.includes("PB.ready(")) {
    issues.push("CRITICAL: Missing PB.ready() call — game will never start");
  }

  // Critical: Must have PB.onStart
  if (!inner.includes("PB.onStart")) {
    issues.push("CRITICAL: Missing PB.onStart() — game loop won't begin after countdown");
  }

  // Critical: Must have requestAnimationFrame or game loop
  if (
    !inner.includes("requestAnimationFrame") &&
    !inner.includes("setInterval") &&
    !inner.includes("setTimeout")
  ) {
    issues.push("CRITICAL: No game loop detected (no requestAnimationFrame/setInterval)");
  }

  // Warning: setInterval for game loop (janky)
  if (inner.includes("setInterval") && !inner.includes("requestAnimationFrame")) {
    issues.push("WARNING: Using setInterval for game loop instead of requestAnimationFrame");
  }

  // Must have scoring
  if (!inner.includes("PB.addScore") && !inner.includes("PB.setScore")) {
    issues.push("WARNING: No scoring calls — players will always get 0");
  }

  // Must have canvas creation
  if (!inner.includes("PB.createCanvas")) {
    issues.push("WARNING: No PB.createCanvas() call — no canvas to draw on");
  }

  // Check for forbidden APIs
  if (inner.includes("alert(") || inner.includes("confirm(") || inner.includes("prompt(")) {
    issues.push("CRITICAL: Uses alert/confirm/prompt — blocked in sandbox");
    code = code
      .replace(/alert\([^)]*\)/g, "/* alert blocked */")
      .replace(/confirm\([^)]*\)/g, "true")
      .replace(/prompt\([^)]*\)/g, '""');
    repaired = true;
    issues.push("REPAIRED: Removed alert/confirm/prompt calls");
  }

  // Check for external resource loading
  if (inner.includes("fetch(") && !inner.includes("PB.loadImage")) {
    issues.push("WARNING: Uses fetch() — may fail in sandbox");
  }

  // Check for CDN imports
  if (inner.includes("src=") && inner.includes("http")) {
    issues.push("WARNING: External script/resource detected — will fail in sandbox");
  }

  // Check for IIFE pattern
  if (!inner.includes("(function()") && !inner.includes("(function (") && !inner.includes("(() =>")) {
    issues.push("WARNING: Not wrapped in IIFE — global scope pollution risk");
  }

  // Check for audio usage (juice indicator)
  const hasAudio = inner.includes("PB.audio.");
  if (!hasAudio) {
    issues.push("QUALITY: No PB.audio calls — game will feel silent/dead");
  }

  // Check for juice usage
  const hasParticles = inner.includes("PB.particles");
  const hasShake = inner.includes("PB.shake");
  const hasFloat = inner.includes("PB.float");
  if (!hasParticles && !hasShake && !hasFloat) {
    issues.push("QUALITY: No juice (particles/shake/float) — game will feel flat");
  }

  // Check for PB.updateJuice / PB.drawJuice if juice is used
  if ((hasParticles || hasShake || hasFloat) && !inner.includes("PB.updateJuice")) {
    issues.push("QUALITY: Uses juice but missing PB.updateJuice() in game loop");
  }

  // --- Skeleton Structure Validation ---

  // Check requestAnimationFrame is called unconditionally (not only inside an if)
  // Look for RAF inside the loop function body — it should appear after the paused check, not inside an if block
  const rafCallPattern = /requestAnimationFrame\s*\(\s*loop\s*\)/g;
  const rafCalls = inner.match(rafCallPattern);
  if (rafCalls && rafCalls.length < 2) {
    // Only one RAF call — check if it's inside an if (meaning it could break)
    // A proper skeleton has RAF at end of loop AND in the paused early-return
    issues.push("WARNING: Only 1 requestAnimationFrame(loop) call found — should have 2 (one in paused check, one at end of loop)");
  }

  // Check PB.paused is used in the loop — auto-inject if missing
  if (inner.includes("requestAnimationFrame") && !inner.includes("PB.paused")) {
    // Try to inject PB.paused check at the beginning of the loop function
    const loopMatch = inner.match(/function\s+loop\s*\(\s*\)\s*\{/);
    if (loopMatch && loopMatch.index !== undefined) {
      const insertAt = loopMatch.index + loopMatch[0].length;
      const before = inner.slice(0, insertAt);
      const after = inner.slice(insertAt);
      const injection = "\n    if (PB.paused) { requestAnimationFrame(loop); return; }";
      code = `<script>${before}${injection}${after}</script>`;
      repaired = true;
      issues.push("REPAIRED: Auto-injected PB.paused check in game loop");
    } else {
      issues.push("WARNING: Missing PB.paused check in game loop — game won't pause when tab is hidden");
    }
  }

  // Re-parse inner after possible repair above
  const innerAfterPause = code.replace(/^<script>/, "").replace(/<\/script>$/, "");

  // Check PB.updateJuice is called in loop — auto-inject if missing
  if (!innerAfterPause.includes("PB.updateJuice")) {
    const loopMatch2 = innerAfterPause.match(/function\s+loop\s*\(\s*\)\s*\{[^}]*if\s*\(\s*PB\.paused\s*\)[^;]*;/);
    if (loopMatch2 && loopMatch2.index !== undefined) {
      const insertAt = loopMatch2.index + loopMatch2[0].length;
      const before = innerAfterPause.slice(0, insertAt);
      const after = innerAfterPause.slice(insertAt);
      const injection = "\n    PB.updateJuice();";
      code = `<script>${before}${injection}${after}</script>`;
      repaired = true;
      issues.push("REPAIRED: Auto-injected PB.updateJuice() in game loop");
    } else {
      issues.push("WARNING: Missing PB.updateJuice() — juice effects won't animate");
    }
  }

  // Re-parse inner after possible repair above
  const innerAfterJuice = code.replace(/^<script>/, "").replace(/<\/script>$/, "");

  // Check PB.drawJuice is called after drawing — auto-inject if missing
  if (!innerAfterJuice.includes("PB.drawJuice") && innerAfterJuice.includes("ctx.restore")) {
    // Insert PB.drawJuice after the last ctx.restore()
    const lastRestore = innerAfterJuice.lastIndexOf("ctx.restore()");
    if (lastRestore >= 0) {
      const afterRestore = innerAfterJuice.indexOf(";", lastRestore);
      if (afterRestore >= 0) {
        const before = innerAfterJuice.slice(0, afterRestore + 1);
        const after = innerAfterJuice.slice(afterRestore + 1);
        // Try to find W and H references for the drawJuice call
        const hasWH = innerAfterJuice.includes("var W") || innerAfterJuice.includes("W =");
        const injection = hasWH ? "\n    PB.drawJuice(ctx, W, H);" : "\n    PB.drawJuice(ctx, window.innerWidth, window.innerHeight);";
        code = `<script>${before}${injection}${after}</script>`;
        repaired = true;
        issues.push("REPAIRED: Auto-injected PB.drawJuice() after ctx.restore()");
      }
    }
  }

  // --- Crash Pattern Detection ---

  // Detect unsafe .filter()[0].property — common crash when filter returns empty
  if (innerAfterJuice.match(/\.filter\([^)]*\)\[0\]\./)) {
    issues.push("CRITICAL: Unsafe .filter()[0].property — will crash if filter returns empty array. Use: var arr = x.filter(...); if (arr.length) arr[0].property");
  }

  // Detect unguarded array random access like arr[PB.randomInt(...)].x without length check
  if (innerAfterJuice.match(/\[\s*PB\.randomInt\([^)]*\)\s*\]\s*\./)) {
    // Check if there's a length check nearby
    if (!innerAfterJuice.includes(".length")) {
      issues.push("WARNING: Array access with PB.randomInt without length check — may crash on empty array");
    }
  }

  // Detect accessing properties on array elements in for loops without guard
  // Pattern: common crash is accessing holes after splice in forward iteration
  const forwardSplicePattern = /for\s*\(\s*var\s+\w+\s*=\s*0[^)]*\)[^}]*\.splice\(/;
  if (innerAfterJuice.match(forwardSplicePattern)) {
    issues.push("WARNING: Forward for-loop with splice — iterate from length-1 to 0 to avoid skipping elements and accessing undefined");
  }

  // --- Phase 3A: Enhanced Static Analysis ---

  // Object pool check: spawning without cleanup
  const spawnPatterns = (inner.match(/\.push\(/g) || []).length;
  const cleanupPatterns = (inner.match(/\.splice\(/g) || []).length;
  if (spawnPatterns > 0 && cleanupPatterns === 0) {
    issues.push("WARNING: Objects are spawned (.push) but never cleaned up (.splice) — memory leak risk");
  }

  // Score achievability check
  const addScoreMatches: string[] = inner.match(/PB\.addScore\(\s*(-?\d+)/g) || [];
  const hasPositiveScore = addScoreMatches.some(m => {
    const num = parseInt(m.replace(/PB\.addScore\(\s*/, ""));
    return num > 0;
  });
  const hasSetScore = inner.includes("PB.setScore");
  if (addScoreMatches.length > 0 && !hasPositiveScore && !hasSetScore) {
    issues.push("WARNING: Only negative PB.addScore calls found — players can never gain points");
  }

  // Theme color usage check
  const usesThemeColors = inner.includes("PB.theme.") || inner.includes("PB.player.color");
  if (!usesThemeColors) {
    issues.push("QUALITY: No PB.theme.* or PB.player.color usage — game won't match visual theme");
  }

  // Mobile input check
  const hasMobileInput =
    inner.includes("onTap") ||
    inner.includes("onSwipe") ||
    inner.includes("pointerDown") ||
    inner.includes("PB.input.left") ||
    inner.includes("PB.input.action");
  if (!hasMobileInput) {
    issues.push("WARNING: No mobile input detected (onTap/onSwipe/pointerDown/PB.input) — game may be unplayable on mobile");
  }

  // Draw call estimation: warn about potential overload in loop
  const fillRectCount = (inner.match(/fillRect|fillText|arc|drawImage/g) || []).length;
  if (fillRectCount > 50) {
    issues.push("WARNING: High number of draw calls (~" + fillRectCount + ") — may cause performance issues");
  }

  // --- Phase 3B: Auto-Inject Juice Safety Net ---
  const hasAnyJuice = hasParticles || hasShake || hasFloat;
  if (!hasAnyJuice && inner.includes("PB.addScore")) {
    // Wrap PB.addScore to auto-add juice
    const juiceInjection = `
// [PB Auto-Juice] Injected because game had no juice effects
var _origAddScore = PB.addScore.bind(PB);
var _origSetScore = PB.setScore.bind(PB);
PB.addScore = function(n) {
  _origAddScore(n);
  if (n > 0) {
    var cx = PB.input.pointerX || 200;
    var cy = PB.input.pointerY || 200;
    PB.particles(cx, cy, {count:6, color: PB.theme.accentColor || "#ffd700"});
    PB.float("+" + n, cx, cy - 20, {color: PB.theme.accentColor || "#ffd700"});
  } else if (n < 0) {
    PB.shake(5);
    PB.flash("#ef4444", 8);
  }
};
PB.setScore = function(n) {
  _origSetScore(n);
};
`;
    // Inject after the IIFE opening
    const iifeStart = inner.indexOf("(function()");
    if (iifeStart >= 0) {
      const insertPoint = inner.indexOf("{", iifeStart);
      if (insertPoint >= 0) {
        const before = inner.slice(0, insertPoint + 1);
        const after = inner.slice(insertPoint + 1);
        code = `<script>${before}${juiceInjection}${after}</script>`;
        repaired = true;
        issues.push("REPAIRED: Auto-injected juice effects for PB.addScore (game had no particles/shake/float)");
      }
    }
  }

  const hasCritical = issues.some((i) => i.startsWith("CRITICAL"));
  return {
    valid: !hasCritical,
    issues,
    repaired,
    code,
  };
}

/**
 * Quick structural check — is this gameCode likely to produce a working game?
 * Returns true if it passes minimum requirements.
 */
export function isGameCodeViable(gameCode: string): boolean {
  if (!gameCode || gameCode.length < 80) return false;
  const inner = gameCode.replace(/<\/?script>/g, "");
  return (
    inner.includes("PB.ready") &&
    inner.includes("PB.onStart") &&
    (inner.includes("requestAnimationFrame") || inner.includes("setInterval"))
  );
}

/**
 * Phase 3C: Cross-round diversity check.
 * Detects game type per round via heuristics and warns if not enough variety.
 */
export function checkRoundDiversity(rounds: { gameCode?: string; title?: string }[]): string[] {
  const issues: string[] = [];
  const types: string[] = [];

  for (const round of rounds) {
    if (!round.gameCode) {
      types.push("unknown");
      continue;
    }
    const code = round.gameCode.toLowerCase();
    types.push(detectGameType(code));
  }

  // Count distinct types
  const distinct = new Set(types.filter(t => t !== "unknown"));
  if (distinct.size < 3 && rounds.length >= 5) {
    issues.push(
      `DIVERSITY: Only ${distinct.size} distinct game types detected across ${rounds.length} rounds (${[...distinct].join(", ")}). Aim for 3+ different types.`
    );
  }

  // Check for back-to-back same type
  for (let i = 1; i < types.length; i++) {
    if (types[i] !== "unknown" && types[i] === types[i - 1]) {
      issues.push(
        `DIVERSITY: Rounds ${i} and ${i + 1} are both "${types[i]}" — consider more variety`
      );
    }
  }

  return issues;
}

function detectGameType(code: string): string {
  // Heuristic detection of game mechanics
  if (code.includes("falling") || (code.includes(".y +=") && code.includes("splice") && code.includes("push"))) {
    if (code.includes("ontap") || code.includes("tap")) return "tap-target";
    return "falling-items";
  }
  if (code.includes("runner") || (code.includes("scrollspeed") || code.includes("speed") && code.includes("jump"))) {
    return "runner";
  }
  if (code.includes("grid") || code.includes("cols") && code.includes("rows")) {
    if (code.includes("memory") || code.includes("sequence")) return "memory";
    if (code.includes("match") || code.includes("swap")) return "puzzle";
    return "grid-game";
  }
  if (code.includes("ontap") && !code.includes(".y +=")) {
    return "tap-target";
  }
  if (code.includes("onswipe") || code.includes("swipe")) {
    return "swipe-game";
  }
  if (code.includes("dodge") || code.includes("avoid")) {
    return "dodge";
  }
  if (code.includes("aim") || code.includes("shoot") || code.includes("bullet")) {
    return "shooter";
  }
  if (code.includes("stack") || code.includes("tower")) {
    return "stacker";
  }
  if (code.includes("balance") || code.includes("tilt")) {
    return "balance";
  }
  return "unknown";
}
