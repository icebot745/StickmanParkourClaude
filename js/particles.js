// particles.js — Particle system

class Particle {
    constructor(x, y, vx, vy, color, life, size, gravity = 0) {
        this.x = x;   this.y = y;
        this.vx = vx; this.vy = vy;
        this.color = color;
        this.life    = life;
        this.maxLife = life;
        this.size    = size;
        this.gravity = gravity;
    }

    update(dt) {
        this.vx *= 0.93;
        this.vy += this.gravity * dt;
        this.x  += this.vx * dt;
        this.y  += this.vy * dt;
        this.life -= dt;
    }

    draw(ctx, cameraX) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - cameraX, this.y, Math.max(0.5, this.size * (0.5 + alpha * 0.5)), 0, Math.PI * 2);
        ctx.fill();
    }

    get dead() { return this.life <= 0; }
}

const Particles = {
    list: [],

    // Internal helper: emit a burst of particles
    _burst(x, y, count, colors, speedMin, speedMax, life, sizeMin, sizeMax,
           gravity, angleMin = 0, angleMax = Math.PI * 2, vyBias = 0) {
        for (let i = 0; i < count; i++) {
            const angle = angleMin + Math.random() * (angleMax - angleMin);
            const speed = speedMin + Math.random() * (speedMax - speedMin);
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size  = sizeMin + Math.random() * (sizeMax - sizeMin);
            const life_ = life * (0.55 + Math.random() * 0.9);
            this.list.push(new Particle(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed + vyBias,
                color, life_, size, gravity
            ));
        }
    },

    // Red burst on player death
    death(x, y) {
        this._burst(x, y, 24,
            ['#FF5252', '#FF1744', '#FF6E40', '#FFAB40'],
            60, 240, 0.7, 2.5, 5.5, 380);
    },

    // Orange / gold burst on checkpoint activation
    checkpoint(x, y) {
        this._burst(x, y, 20,
            ['#FF9800', '#FFD700', '#FFF176', '#FF5722'],
            55, 165, 0.9, 2, 4.5, 280,
            0, Math.PI * 2, -65);
    },

    // Gold upward burst on boost teleport
    boost(x, y) {
        this._burst(x, y, 28,
            ['#FFD700', '#FFF9C4', '#FFEB3B', '#FFC107'],
            80, 270, 0.5, 2.5, 5, 240,
            -Math.PI * 1.1, Math.PI * 0.1);
    },

    // Fire sparks on magma hit
    magma(x, y) {
        this._burst(x, y, 16,
            ['#FF5722', '#FF9800', '#FFEB3B', '#F44336'],
            75, 210, 0.45, 2, 4.5, 520,
            -Math.PI, 0, -90);
    },

    // Bright green upward burst on bounce pad
    bounce(x, y) {
        this._burst(x, y, 18,
            ['#76FF03', '#CCFF90', '#69F0AE', '#B9F6CA'],
            80, 220, 0.55, 2, 4.5, 200,
            -Math.PI, 0, -120);
    },

    // Dust puff on landing
    land(x, y) {
        this._burst(x, y, 10,
            ['rgba(180,160,130,1)', 'rgba(200,180,150,1)', 'rgba(160,140,110,1)'],
            22, 85, 0.28, 1.5, 3, 110,
            Math.PI * 0.55, Math.PI * 1.45, -18);
    },

    // Cyan speed-line streaks while rolling (call each frame)
    roll(x, y, facing) {
        const colors = ['#00E5FF', '#80DEEA', '#B2EBF2'];
        for (let i = 0; i < 2; i++) {
            this.list.push(new Particle(
                x + (Math.random() - 0.5) * 8,
                y + (Math.random() - 0.5) * 10,
                -facing * (65 + Math.random() * 95),
                (Math.random() - 0.5) * 32,
                colors[Math.floor(Math.random() * colors.length)],
                0.11 + Math.random() * 0.10,
                1.4 + Math.random() * 1.2,
                0
            ));
        }
    },

    // Colourful confetti on level complete — world-space coords
    complete(cx, cy, w) {
        const colors = ['#FFD700', '#FF5252', '#69F0AE', '#40C4FF', '#E040FB', '#FFAB40', '#FFFFFF'];
        for (let i = 0; i < 80; i++) {
            const px    = cx + (Math.random() - 0.5) * w * 0.9;
            const py    = cy * 0.2 + Math.random() * cy * 0.5;
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
            const speed = 55 + Math.random() * 190;
            this.list.push(new Particle(
                px, py,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                colors[Math.floor(Math.random() * colors.length)],
                1.5 + Math.random() * 1.0,
                3 + Math.random() * 3.5,
                290
            ));
        }
    },

    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            this.list[i].update(dt);
            if (this.list[i].dead) this.list.splice(i, 1);
        }
    },

    draw(ctx, cameraX) {
        ctx.save();
        for (const p of this.list) p.draw(ctx, cameraX);
        ctx.globalAlpha = 1;
        ctx.restore();
    },

    clear() { this.list = []; },
};
