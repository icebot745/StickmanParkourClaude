// player.js — Stick figure physics, animation, controls

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 40;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.facing = 1; // 1 = right, -1 = left
        this.animTime = 0;
        this.state = 'idle'; // idle, running, jumping, falling, rolling

        // Physics constants
        this.speed = 260;
        this.jumpForce = -500;
        this.gravity = 1200;
        this.friction = 0.85;
        this.maxFallSpeed = 800;

        // Spawn point
        this.spawnX = x;
        this.spawnY = y;

        // Block interaction state
        this.standingBlock = null;
        this.knockbackTimer = 0;

        // Roll state
        this.rollTimer    = 0;  // seconds remaining on active roll
        this.rollCooldown = 0;  // seconds remaining on cooldown after roll ends
    }

    update(dt, blocks) {
        // Decrement knockback timer
        if (this.knockbackTimer > 0) this.knockbackTimer -= dt;

        // Roll cooldown countdown
        if (this.rollCooldown > 0) { this.rollCooldown -= dt; if (this.rollCooldown < 0) this.rollCooldown = 0; }

        // Roll activation (only when not rolling and not on cooldown)
        if (Input.down && this.onGround && this.rollTimer <= 0 && this.rollCooldown <= 0) {
            this.rollTimer = 10;
            Sound.roll();
        }

        // Roll duration countdown — when it expires start the cooldown
        if (this.rollTimer > 0) {
            this.rollTimer -= dt;
            if (this.rollTimer <= 0) {
                this.rollTimer = 0;
                this.rollCooldown = 20;
            }
        }

        // Reset standing block each frame before collisions
        this.standingBlock = null;

        // Horizontal input
        let moveX = 0;
        if (Input.right) moveX = 1;
        if (Input.left) moveX = -1;

        // Speed boost while rolling
        const currentSpeed = this.rollTimer > 0 ? this.speed * 1.6 : this.speed;

        if (moveX !== 0) {
            // On slime: cap horizontal speed
            if (this.onGround && this.standingBlock && this.standingBlock.type === BlockType.SLIME) {
                const cappedSpeed = currentSpeed * 0.55;
                this.vx = moveX * cappedSpeed;
            } else {
                this.vx = moveX * currentSpeed;
            }
            this.facing = moveX;
        } else {
            // On slime: apply stronger friction
            if (this.onGround && this.standingBlock && this.standingBlock.type === BlockType.SLIME) {
                this.vx *= 0.7;
            } else {
                this.vx *= this.friction;
            }
            if (Math.abs(this.vx) < 5) this.vx = 0;
        }

        // Jump
        if (Input.jump && this.onGround) {
            if (this.standingBlock && this.standingBlock.type === BlockType.SLIME) {
                this.vy = this.jumpForce * 1.6;
                Sound.slimeBounce();
            } else {
                this.vy = this.jumpForce;
                Sound.jump();
            }
            this.onGround = false;
        }

        // Gravity
        this.vy += this.gravity * dt;
        if (this.vy > this.maxFallSpeed) this.vy = this.maxFallSpeed;

        // Move horizontally and check collisions
        this.x += this.vx * dt;
        this.resolveCollisionsX(blocks);

        // Move vertically and check collisions
        const wasOnGround = this.onGround;
        this.y += this.vy * dt;
        this.onGround = false;
        this.resolveCollisionsY(blocks);

        // Landing detection — fire sound + dust on first ground contact
        if (!wasOnGround && this.onGround) {
            Sound.land();
            Particles.land(this.x + this.width / 2, this.y + this.height);
        }

        // Conveyor belt push after all collision resolution
        if (this.onGround && this.standingBlock && this.standingBlock.type === BlockType.CONVEYOR) {
            this.x += this.standingBlock.direction * this.standingBlock.conveyorSpeed * dt;
        }

        // Moving platform carry — player rides with the block
        if (this.onGround && this.standingBlock && this.standingBlock.type === BlockType.MOVING) {
            this.x += this.standingBlock.dx;
        }

        // Roll speed-line particles (emitted each frame while rolling on ground)
        if (this.rollTimer > 0 && this.onGround) {
            Particles.roll(this.x + this.width / 2, this.y + this.height, this.facing);
        }

        // Update animation state
        if (!this.onGround) {
            this.state = this.vy < 0 ? 'jumping' : 'falling';
        } else if (this.rollTimer > 0) {
            this.state = 'rolling';
        } else if (Math.abs(this.vx) > 10) {
            this.state = 'running';
        } else {
            this.state = 'idle';
        }

        this.animTime += dt;

        // Check if fallen into void
        return this.y > 800;
    }

    resolveCollisionsX(blocks) {
        for (const block of blocks) {
            if (!block.active) continue;
            if (this.overlaps(block)) {
                // MAGMA side collision: launch forward
                if (block.type === BlockType.MAGMA && this.knockbackTimer <= 0) {
                    this.vx = this.facing * 700;
                    this.vy = -250;
                    this.knockbackTimer = 0.6;
                    this.onGround = false;
                    // Push player past the block so normal resolver doesn't cancel the velocity
                    if (this.facing > 0) {
                        this.x = block.x + block.width + 1;
                    } else {
                        this.x = block.x - this.width - 1;
                    }
                    Sound.magma();
                    Particles.magma(this.x + this.width / 2, this.y + this.height / 2);
                    continue;
                }
                // Normal resolution
                if (this.vx > 0) {
                    this.x = block.x - this.width;
                } else if (this.vx < 0) {
                    this.x = block.x + block.width;
                }
                this.vx = 0;
            }
        }
    }

    resolveCollisionsY(blocks) {
        for (const block of blocks) {
            if (!block.active) continue;
            if (this.overlaps(block)) {
                if (this.vy > 0) {
                    // Landing on top of block
                    this.standingBlock = block;

                    if (block.type === BlockType.MAGMA && this.knockbackTimer <= 0) {
                        // Magma top: launch forward — place player above block first
                        // so the normal resolver doesn't see an overlap and cancel the velocity
                        this.y = block.y - this.height - 1;
                        this.vy = -380;
                        this.vx = this.facing * 700;
                        this.knockbackTimer = 0.6;
                        this.onGround = false;
                        Sound.magma();
                        Particles.magma(this.x + this.width / 2, block.y);
                        continue;
                    }

                    if (block.type === BlockType.BOUNCE) {
                        // Bounce pad: launch straight up with high force
                        this.y = block.y - this.height;
                        this.vy = -950;
                        this.onGround = false;
                        Sound.slimeBounce();
                        Particles.bounce(this.x + this.width / 2, block.y);
                        continue;
                    }

                    // Normal landing (also handles SLIME and DISAPPEARING)
                    this.y = block.y - this.height;
                    this.vy = 0;
                    this.onGround = true;

                    // Trigger disappearing block on land
                    if (block.type === BlockType.DISAPPEARING) {
                        block.triggerDisappear();
                    }

                } else if (this.vy < 0) {
                    // Hitting from below
                    this.y = block.y + block.height;
                    this.vy = 0;
                }
            }
        }
    }

    overlaps(block) {
        return (
            this.x < block.x + block.width &&
            this.x + this.width > block.x &&
            this.y < block.y + block.height &&
            this.y + this.height > block.y
        );
    }

    respawn() {
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.state = 'idle';
        this.knockbackTimer = 0;
        this.standingBlock = null;
        this.rollTimer = 0;
        this.rollCooldown = 0;
    }

    setSpawn(x, y) {
        this.spawnX = x;
        this.spawnY = y;
    }

    draw(ctx, cameraX) {
        const screenX = this.x - cameraX + this.width / 2;
        const screenY = this.y;

        // Cyan glow effect when rolling
        if (this.rollTimer > 0) {
            const glowPulse = 0.65 + Math.sin(performance.now() * 0.009) * 0.35;
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur = 18 * glowPulse;
        }

        ctx.save();
        ctx.translate(screenX, screenY);

        switch (this.state) {
            case 'rolling':
                this.drawRolling(ctx);
                break;
            case 'running':
                this.drawRunning(ctx);
                break;
            case 'jumping':
                this.drawJumping(ctx);
                break;
            case 'falling':
                this.drawFalling(ctx);
                break;
            default:
                this.drawIdle(ctx);
        }

        ctx.restore();

        // Reset shadow after drawing
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }

    drawIdle(ctx) {
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(0, 8, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(0, 28);
        ctx.stroke();

        // Arms (relaxed)
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(-8, 26);
        ctx.moveTo(0, 18);
        ctx.lineTo(8, 26);
        ctx.stroke();

        // Legs (standing)
        ctx.beginPath();
        ctx.moveTo(0, 28);
        ctx.lineTo(-6, 40);
        ctx.moveTo(0, 28);
        ctx.lineTo(6, 40);
        ctx.stroke();
    }

    drawRunning(ctx) {
        const cycle = Math.sin(this.animTime * 12) * this.facing;
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        // Head (slight bob)
        const headBob = Math.abs(Math.sin(this.animTime * 12)) * 1.5;
        ctx.beginPath();
        ctx.arc(0, 7 + headBob, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Body (slight lean forward)
        const lean = this.facing * 2;
        ctx.beginPath();
        ctx.moveTo(lean * 0.5, 13 + headBob);
        ctx.lineTo(lean, 28);
        ctx.stroke();

        // Arms (swinging opposite to legs)
        ctx.beginPath();
        ctx.moveTo(lean * 0.7, 17 + headBob);
        ctx.lineTo(lean * 0.7 + cycle * 8, 26 - Math.abs(cycle) * 3);
        ctx.moveTo(lean * 0.7, 17 + headBob);
        ctx.lineTo(lean * 0.7 - cycle * 8, 26 - Math.abs(cycle) * 3);
        ctx.stroke();

        // Legs (running cycle)
        ctx.beginPath();
        ctx.moveTo(lean, 28);
        ctx.lineTo(lean + cycle * 10, 40);
        ctx.moveTo(lean, 28);
        ctx.lineTo(lean - cycle * 10, 40);
        ctx.stroke();
    }

    drawJumping(ctx) {
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(0, 8, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(0, 28);
        ctx.stroke();

        // Arms (raised up)
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(-10, 12);
        ctx.moveTo(0, 18);
        ctx.lineTo(10, 12);
        ctx.stroke();

        // Legs (tucked)
        ctx.beginPath();
        ctx.moveTo(0, 28);
        ctx.lineTo(-7, 36);
        ctx.moveTo(0, 28);
        ctx.lineTo(7, 36);
        ctx.stroke();
    }

    drawFalling(ctx) {
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(0, 8, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(0, 28);
        ctx.stroke();

        // Arms (spread wide, flailing)
        const flail = Math.sin(this.animTime * 15) * 3;
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(-12, 14 + flail);
        ctx.moveTo(0, 18);
        ctx.lineTo(12, 14 - flail);
        ctx.stroke();

        // Legs (dangling)
        ctx.beginPath();
        ctx.moveTo(0, 28);
        ctx.lineTo(-5, 40 + flail);
        ctx.moveTo(0, 28);
        ctx.lineTo(5, 40 - flail);
        ctx.stroke();
    }

    drawRolling(ctx) {
        const spin = this.animTime * 10 * this.facing;
        ctx.save();
        ctx.translate(0, 20); // shift down to crouched position
        ctx.rotate(spin);

        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        // Outer circle (body + head merged into a ball)
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();

        // Tucked limbs visible through the spin
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(-5, 7);
        ctx.moveTo(11, 0);
        ctx.lineTo(5, 7);
        ctx.moveTo(0, -11);
        ctx.lineTo(0, -5);
        ctx.stroke();

        ctx.restore();
    }
}
