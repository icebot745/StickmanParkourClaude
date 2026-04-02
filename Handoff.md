# Parkour Void Runner — Session Handoff

## What is this?
A side-scrolling 2D canvas parkour game built as a standalone web app (no frameworks, no dependencies). A stick figure navigates 200 procedurally generated floating blocks over a void. Time-attack scoring.

## Current Status: Phase 1 Complete (of 5)

### What's built (Phase 1):
- Canvas game engine with requestAnimationFrame game loop
- Gradient sky background with parallax mountain layers and void below
- Animated stick figure with 4 states: idle, running, jumping, falling
- Physics: gravity, velocity, collision detection (separate X/Y resolution)
- 20 hand-placed dirt/grass blocks with polished rendering
- Keyboard controls: Arrow keys / WASD + SPACE to jump
- Fall-into-void detection → red flash → respawn
- Start screen with pulsing prompt
- Camera that follows player with smooth lookahead

### What's NOT built yet (Phases 2-5):
- Phase 2: Procedural generation (200 blocks) + checkpoints + difficulty ramp
- Phase 3: Disappearing, slime, conveyor, magma block types
- Phase 4: Roll/duck mechanic, 10-min timer, scoring, game flow screens
- Phase 5: Sound (Web Audio API), mobile swipe controls, particles, polish

### Key architecture:
- Global singletons: Game, Input; Classes: Player, Block
- Files: index.html, css/style.css, js/input.js, js/blocks.js, js/player.js, js/game.js
- Files to create later: js/level.js, js/particles.js, js/sound.js
- Void death at y > 800, blocks are 30px tall, collision uses separate X/Y passes

### Next step: Build Phase 2
Read PLAN.md for full spec. Read all existing JS files before modifying.
