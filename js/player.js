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
        this.state = 'idle'; // idle, running, jumping, falling

        // Physics constants
        this.speed = 260;
        this.jumpForce = -500;
        this.gravity = 1200;
        this.friction = 0.85;
        this.maxFallSpeed = 800;

        // Spawn point
        this.spawnX = x;
        this.spawnY = y;
    }

    update(dt, blocks) {
        // Horizontal input
        let moveX = 0;
        if (Input.right) moveX = 1;
        if (Input.left) moveX = -1;

        if (moveX !== 0) {
            this.vx = moveX * this.speed;
            this.facing = moveX;
        } else {
            this.vx *= this.friction;
            if (Math.abs(this.vx) < 5) this.vx = 0;
        }

        // Jump
        if (Input.jump && this.onGround) {
            this.vy = this.jumpForce;
            this.onGround = false;
        }

        // Gravity
        this.vy += this.gravity * dt;
        if (this.vy > this.maxFallSpeed) this.vy = this.maxFallSpeed;

        // Move horizontally and check collisions
        this.x += this.vx * dt;
        this.resolveCollisionsX(blocks);

        // Move vertically and check collisions
        this.y += this.vy * dt;
        this.onGround = false;
        this.resolveCollisionsY(blocks);

        // Update animation state
        if (!this.onGround) {
            this.state = this.vy < 0 ? 'jumping' : 'falling';
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
                    // Landing on top
                    this.y = block.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
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
    }

    setSpawn(x, y) {
        this.spawnX = x;
        this.spawnY = y;
    }

    draw(ctx, cameraX) {
        const screenX = this.x - cameraX + this.width / 2;
        const screenY = this.y;

        ctx.save();
        ctx.translate(screenX, screenY);

        switch (this.state) {
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
}
