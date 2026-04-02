# Parkour Void Runner — Session Handoff

## What is this?
A side-scrolling 2D canvas parkour game built as a standalone web app (no frameworks, no dependencies). A stick figure navigates 200 procedurally generated floating blocks over a void. Time-attack scoring.

## Current Status: Phase 2 Complete (of 5)

### What's built (Phase 1 + 2):
- Canvas game engine with requestAnimationFrame game loop
- Gradient sky background with parallax mountain layers and void below
- Animated stick figure with 4 states: idle, running, jumping, falling
- Physics: gravity, velocity, collision detection (separate X/Y resolution)
- Keyboard controls: Arrow keys / WASD + SPACE to jump
- Fall-into-void detection → red flash → respawn
- Start screen with pulsing prompt
- Camera that follows player with smooth lookahead
- **Procedural level generation** — 200 blocks per run, random each time
- **Eased difficulty ramp** — platforms shrink and gaps grow using a quadratic curve
- **Consecutive-gap safety** — prevents two large gaps back to back
- **4 checkpoints** at ~25%, 50%, 75%, 95% — wider platforms for fairness
- **Checkpoint activation feedback** — orange glow halo, gold pole/flag, 1.5s banner
- **Finish block** — wide platform (index 199) with gold pole + checkerboard "FINISH" flag
- **Level complete state** — "YOU MADE IT!" screen with checkpoint count + play-again prompt
- **HUD** — block counter, progress bar (turns gold on complete), 4 checkpoint indicators

### What's NOT built yet (Phases 3-5):
- Phase 3: Disappearing, slime, conveyor, magma block types
- Phase 4: Roll/duck mechanic, 10-min countdown timer, time-based scoring, full game-flow screens
- Phase 5: Sound (Web Audio API), mobile swipe controls, particles, polish

### Key architecture:
- Global singletons: Game, Input, Level; Classes: Player, Block
- Files: index.html, css/style.css, js/input.js, js/blocks.js, js/player.js, js/level.js, js/game.js
- Void death at y > 800, blocks are 30px tall, collision uses separate X/Y passes
- Game states: 'start' | 'playing' | 'dead' | 'complete'
- Block properties: x, y, width, height, type, active, checkpoint, finish, blockIndex, activatedTime

### Next step: Build Phase 3
Add the 4 special block types to blocks.js and integrate weighted distribution into level.js generation.
Read PLAN.md for full spec. Read all existing JS files before modifying.
