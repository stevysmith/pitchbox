# E2E Game Quality Test Prompt

Use this prompt with the `agent-browser` skill to verify all 9 phases of the Phaser 3 game quality upgrade.

---

## Prompt

```
Navigate to http://localhost:3000 and perform the following end-to-end test of the pitch.box party game platform. Take screenshots at each major checkpoint. Check the browser console for errors after each step.

### Step 1: Create a Room
1. On the homepage, enter a game prompt like "Space pirates fighting over cosmic pizza"
2. Wait for AI to generate the game (or click any quick-start option if available)
3. Take a screenshot of the lobby
4. Enter a player name (e.g., "Tester1") and join the room
5. Note the room code shown

### Step 2: Open a Second Player Tab
1. Open a new browser tab to http://localhost:3000
2. Join the same room using the room code
3. Enter a different player name (e.g., "Tester2")
4. Go back to the first tab and start the game

### Step 3: Verify Countdown (Phase 4)
When the first round loads:
1. **CHECKPOINT**: Verify a "3... 2... 1... GO!" countdown overlay appears
2. Verify each number scales in then fades out
3. Verify the game does NOT accept input during countdown (player should not move)
4. Verify "GO!" appears in green
5. Take a screenshot during the countdown if possible
6. Check console: no errors should appear

### Step 4: Verify Visual Polish (Phases 1, 3, 8)
Once the round starts:
1. **CHECKPOINT**: Verify the camera fades in smoothly (not an instant cut)
2. Look at the background — verify there is a parallax midground layer (subtle shapes between background and gameplay)
3. Look at ground/platform tiles — verify slight color variation between tiles (not uniform blocks)
4. Watch the player sprite — verify it has a subtle "breathing" animation (gentle scale oscillation) when standing still
5. Move the player — verify it has a bobbing/leaning animation when running
6. Take a screenshot showing the game in action

### Step 5: Verify Game Feel - Platformer/Runner/Climber (Phase 7)
If the round is a platformer, runner, or climber type:
1. Run off a platform edge and press jump slightly after leaving — verify coyote time works (jump should still execute within ~80ms of leaving edge)
2. Press jump while in the air just before landing — verify jump buffering works (jump executes on next ground contact)
3. Verify jump/land audio plays

If the round is arena, dodge, or catcher type:
1. Move left/right — verify movement has slight momentum (acceleration + drag, not instant velocity)
2. Stop pressing movement — verify player slides slightly before stopping

### Step 6: Verify Juice on Collect (Phase 1)
1. Collect an item (collectible/coin/star)
2. **CHECKPOINT**: Verify an 8-particle burst appears at the collection point
3. Verify floating "+10" (or similar) text rises and fades above the collection point
4. Verify the score text in the HUD does a brief scale-up "pop" animation
5. Take a screenshot if you can capture the particles

### Step 7: Verify Juice on Damage (Phase 1)
1. Deliberately hit a hazard or bad item
2. **CHECKPOINT**: Verify the screen shakes briefly
3. Verify a red camera flash appears
4. Verify the player sprite blinks (alpha toggle) several times
5. Verify floating "-5" (or similar) red text appears near the player
6. Take a screenshot during the damage effect if possible

### Step 8: Verify Audio (Phase 2)
Listen for the following sounds during gameplay:
1. **Collect SFX**: Rising tone when collecting an item
2. **Hit SFX**: Falling/harsh tone when taking damage
3. **Jump SFX**: Rising chirp when jumping (platformer/runner/climber scenes)
4. **Land SFX**: Thud when landing from a jump
5. **BGM**: Quiet arpeggiated background music after countdown finishes
6. **CHECKPOINT**: Confirm at least 3 of these audio types are audible
7. Note: If no audio plays, check if the browser requires a user interaction first (click anywhere)

### Step 9: Verify Timer Urgency (Phase 1 + 2)
1. Wait until the timer reaches 5 seconds remaining
2. **CHECKPOINT**: Verify the timer text turns red
3. Verify the timer text pulses (scale animation) each second
4. Verify a "tick" sound plays each second during the last 5 seconds

### Step 10: Verify End-of-Round Polish (Phase 6)
When the round timer hits 0:
1. **CHECKPOINT**: Verify the game briefly enters slow motion
2. Verify the camera zooms in slightly (to ~1.3x)
3. Verify multi-color confetti particles burst from the center
4. Verify the "SCORE: X" text scales in with a bounce animation (not instant)
5. Verify BGM stops
6. Verify the screen fades to black
7. Take a screenshot during the end-of-round celebration

### Step 11: Verify UIScene HUD (Phase 9)
During gameplay:
1. Trigger a screen shake (get hit by a hazard)
2. **CHECKPOINT**: Verify the score and timer text do NOT shake with the camera — they should remain stable (rendered by separate UIScene)

### Step 12: Verify Object Pooling (Phase 5)
If playing a dodge, catcher, or shooter round:
1. Play for the full duration
2. Open the browser console
3. **CHECKPOINT**: Verify no "Cannot read property" or object-related errors
4. Verify no significant frame rate drops as more objects spawn
5. Run `performance.memory` in console if available — note JS heap size

### Step 13: Play Through Multiple Rounds
1. Continue playing through at least 3 different round types
2. Verify countdown appears before EACH round
3. Verify end-of-round celebration plays after EACH round
4. Verify no console errors accumulate between rounds
5. Take a final screenshot of the scores/leaderboard

### Step 14: Console Error Check
1. Open the browser developer console
2. **CHECKPOINT**: Filter for errors (red)
3. Report any errors found — especially:
   - "Cannot read property of undefined/null"
   - "Scene not found"
   - "Texture not found"
   - WebAudio errors
   - Memory-related warnings
4. Take a screenshot of the console

### Summary Report
Provide a pass/fail for each checkpoint:
- [ ] Countdown 3-2-1-GO appears
- [ ] Camera fades in smoothly
- [ ] Parallax midground visible
- [ ] Tile color variation visible
- [ ] Player breathing animation
- [ ] Collect burst particles + floating text
- [ ] Damage flash + shake + blink
- [ ] Audio SFX audible (3+ types)
- [ ] Timer urgency (red + pulse + tick)
- [ ] End-of-round slow-mo + zoom + confetti + score bounce + fade
- [ ] HUD stable during screen shake
- [ ] No console errors in spawn-heavy scenes
- [ ] Multiple rounds work without errors
- [ ] Zero critical console errors
```
