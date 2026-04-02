# Parkour Void Runner — Implementation Plan

## Core Concept

Side-scrolling 2D canvas parkour game. Stick figure navigates 200 procedurally generated floating blocks over a void. Time-attack scoring: 10-minute timer, seconds remaining = score. Unlimited lives with checkpoint respawn.

## Art Style: Minimalist Geometric

* Clean flat colors, subtle drop shadows, smooth gradients
* Calm gradient sky background (light blue to soft orange)
* White animated stick figure with colored accents for states (speed boost glow, etc.)
* Distinct block colors per type
* Particle effects on jumps, landings, deaths

## Block Types (5)

|Block|Visual|Behavior|
|-|-|-|
|**Dirt/Grass**|Green top, brown body|Static, safe platform|
|**Disappearing**|Bright color (red/orange), pulses|Vanishes 2s after touch, reappears after 5s|
|**Slime**|Green/teal, gel-like|Slows movement, higher bounce on jump|
|**Conveyor**|Gray with animated arrows|Moving platform, horizontal or vertical|
|**Magma** (obstacle)|Floating above blocks, orange/red glow|Touch = knocked back 5 blocks|

## Stick Figure

* **Animated**: running legs, arm swing, jump pose, roll tuck
* **Controls** (keyboard): Left/Right = move, Up = jump, Down = roll (duck + speed boost 10s)
* **Controls** (mobile): Swipe left/right/up/down
* **Roll state**: figure visually tucks, hitbox shrinks (duck under magma), speed boost with visual glow for 10s
* **Death**: fall into void → respawn at last checkpoint

## Level Design

* 200 procedurally generated blocks (random each playthrough)
* Varying gaps, heights, and block types
* 4 checkpoints at \~25%, 50%, 75%, and a final one near the end
* Checkpoint = visible flag/marker on the block
* Blocks are small enough that long jumps can clear some
* Difficulty ramps slightly as you progress (thinner platforms, wider gaps)

## Game Flow

1. **Start screen** — Title, "Press Start" / "Tap to Start"
2. **Gameplay** — 10-min countdown timer, block counter showing progress (e.g., "Block 45/200")
3. **Death** — Brief animation, respawn at last checkpoint, timer keeps running
4. **Finish** — Reach block 200, show remaining seconds as score
5. **Time's up** — Game over screen, option to retry

## Technical

* Single standalone HTML file (HTML + CSS + JS + inline audio)
* Canvas-based rendering with requestAnimationFrame game loop
* Simple physics: gravity, velocity, collision detection
* Sound effects via Web Audio API (procedurally generated — no external files)
* Camera follows player horizontally
* Mobile: touch/swipe overlay detection
* Future-proofed: level config object so adding levels later is straightforward

## Out of Scope (for now)

* Leaderboard / high score persistence
* Seeded runs / shareable courses
* Multiple levels (structure supports it, but shipping level 1 only)

## Project Structure

parkour\_void\_runner/

├── index.html # Canvas, UI overlays, mobile controls

├── css/

│ └── style.css # Game UI styling (menus, HUD, mobile overlay)

├── js/

│ ├── game.js # Game loop, state machine, camera

│ ├── player.js # Stick figure physics, animation, controls

│ ├── blocks.js # Block types, behaviors, rendering

│ ├── level.js # Procedural generation, checkpoints

│ ├── particles.js # Particle effects

│ ├── sound.js # Web Audio API sound effects

│ └── input.js # Keyboard + mobile swipe handling

└── PLAN.md





No build tools. Serve locally with: `python3 -m http.server`



\---



\## Build Phases



\### Phase 1: Core Engine + Basic Platforming ✅ COMPLETE

\*\*Deliverable:\*\* Stick figure running and jumping across static dirt/grass blocks. Fall = respawn. Camera follows player.

\- Canvas setup, game loop, gradient sky background

\- Basic stick figure with running/jumping animation

\- Dirt/grass blocks (static, hand-placed \~20 blocks for testing)

\- Gravity, collision detection, landing

\- Fall-into-void detection → respawn at start

\- Keyboard controls (left, right, jump)

\- \*\*TEST: Run, jump across blocks, fall and respawn\*\*



\### Phase 2: Procedural Generation + Checkpoints

\*\*Deliverable:\*\* Full 200-block procedurally generated course with checkpoints and difficulty ramp.

\- Level generator (200 blocks, varying gaps/heights)

\- Difficulty ramp (thinner platforms, wider gaps as you progress)

\- 4 checkpoint flags at 25/50/75/near-end

\- Respawn at last checkpoint instead of start

\- Block progress counter (Block 45/200)

\- \*\*TEST: Full course is playable, checkpoints work, each run is different\*\*



\### Phase 3: Special Block Types

\*\*Deliverable:\*\* All 5 block types functional and integrated into procedural generation.

\- Disappearing blocks (2s vanish, 5s reappear)

\- Slime blocks (slow + high bounce)

\- Conveyor blocks (horizontal + vertical moving platforms)

\- Magma obstacles floating above blocks (knockback 5 blocks)

\- Integrate all types into procedural generator with weighted distribution

\- \*\*TEST: All block types working, course has variety\*\*



\### Phase 4: Roll Mechanic + Timer + Scoring

\*\*Deliverable:\*\* Complete game loop from start to finish.

\- Roll/duck (down key): shrink hitbox, speed boost 10s, visual glow

\- Duck under magma obstacles

\- 10-minute countdown timer

\- Start screen, finish screen (score = seconds remaining), game over screen

\- Retry flow

\- \*\*TEST: Complete game loop — start, play, win/lose, retry\*\*



\### Phase 5: Sound + Mobile + Polish

\*\*Deliverable:\*\* Finished game.

\- Sound effects via Web Audio API (jump, land, death, checkpoint, finish, speed boost)

\- Mobile swipe controls

\- Particle effects (jumps, landings, deaths)

\- Visual polish (block shadows, animations, smooth transitions)

\- \*\*TEST: Ship it\*\*



