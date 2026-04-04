// blocks.js — Block types, behaviors, rendering

const BlockType = {
    DIRT: 'dirt',
    DISAPPEARING: 'disappearing',
    SLIME: 'slime',
    CONVEYOR: 'conveyor',
    MAGMA: 'magma',
    MOVING: 'moving',
    BOUNCE: 'bounce',
};

class Block {
    constructor(x, y, width, height, type = BlockType.DIRT) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.active = true;
        this.checkpoint = false;
        this.finish = false;
        this.blockIndex = 0;
        this.activatedTime = null;

        // DISAPPEARING state
        this.blockState = 'solid'; // 'solid' | 'warning' | 'gone' | 'reappearing'
        this.disappearTimer = 0;
        this.reappearTimer = 0;

        // CONVEYOR state
        this.direction = 1;        // 1 = right, -1 = left
        this.conveyorSpeed = 100;  // px/s
        this.conveyorOffset = 0;   // animation offset

        // MOVING state
        this.startX = x;           // origin X position
        this.moveRange = 80;       // px oscillation range each side
        this.moveSpeed = 1.0;      // oscillation speed multiplier
        this.movePhase = 0;        // starting phase (radians)
        this.dx = 0;               // x delta this frame (for player carry)
    }

    update(dt) {
        if (this.type === BlockType.DISAPPEARING) {
            if (this.blockState === 'warning') {
                this.disappearTimer -= dt;
                if (this.disappearTimer <= 0) {
                    this.blockState = 'gone';
                    this.active = false;
                    this.reappearTimer = 4;
                }
            } else if (this.blockState === 'gone') {
                this.reappearTimer -= dt;
                if (this.reappearTimer <= 0) {
                    // Start fade-in animation; make solid so player can land on it
                    this.blockState = 'reappearing';
                    this.reappearTimer = 0.7;
                    this.active = true;
                    Sound.disappearReappear();
                }
            } else if (this.blockState === 'reappearing') {
                this.reappearTimer -= dt;
                if (this.reappearTimer <= 0) {
                    this.blockState = 'solid';
                    this.reappearTimer = 0;
                }
            }
        }

        if (this.type === BlockType.CONVEYOR) {
            this.conveyorOffset = (this.conveyorOffset + this.direction * 60 * dt) % 30;
        }

        if (this.type === BlockType.MOVING) {
            const prevX  = this.x;
            const prevDx = this.dx;
            this.x  = this.startX + Math.sin(performance.now() * 0.001 * this.moveSpeed + this.movePhase) * this.moveRange;
            this.dx = this.x - prevX;
            // Play a thunk when the platform reverses direction
            if (prevDx !== 0 && Math.sign(this.dx) !== Math.sign(prevDx)) {
                Sound.movingBlock();
            }
        }
    }

    triggerDisappear() {
        if (this.type === BlockType.DISAPPEARING && this.blockState === 'solid') {
            this.blockState = 'warning';
            this.disappearTimer = 1.5;
        }
    }

    draw(ctx, cameraX) {
        // For DISAPPEARING blocks in 'gone' state, skip drawing entirely
        if (this.type === BlockType.DISAPPEARING && this.blockState === 'gone') return;
        if (!this.active && this.type === BlockType.DISAPPEARING) return;

        if (!this.active) return;

        const screenX = this.x - cameraX;
        const screenY = this.y;

        // Skip drawing if off screen
        if (screenX + this.width < -50 || screenX > ctx.canvas.width + 50) return;

        // Route to the appropriate draw method
        switch (this.type) {
            case BlockType.DISAPPEARING:
                this.drawDisappearing(ctx, screenX, screenY);
                break;
            case BlockType.SLIME:
                this.drawSlime(ctx, screenX, screenY);
                break;
            case BlockType.CONVEYOR:
                this.drawConveyor(ctx, screenX, screenY);
                break;
            case BlockType.MAGMA:
                this.drawMagma(ctx, screenX, screenY);
                break;
            case BlockType.MOVING:
                this.drawMoving(ctx, screenX, screenY);
                break;
            case BlockType.BOUNCE:
                this.drawBounce(ctx, screenX, screenY);
                break;
            default:
                this.drawDirt(ctx, screenX, screenY);
                break;
        }

        if (this.checkpoint) {
            this.drawCheckpointFlag(ctx, screenX, screenY);
        }

        if (this.finish === true) {
            this.drawFinishFlag(ctx, screenX, screenY);
        }
    }

    drawDisappearing(ctx, x, y) {
        ctx.save();

        // Warning state: flash alpha and shake
        if (this.blockState === 'warning') {
            const flash = Math.sin(performance.now() * 0.025) > 0;
            ctx.globalAlpha = flash ? 1 : 0.3;
            // Horizontal shake when close to disappearing
            if (this.disappearTimer < 0.5) {
                x += Math.sin(performance.now() * 0.08) * 4;
            }
        }

        // Reappearing state: fade in from transparent, pulse glow
        if (this.blockState === 'reappearing') {
            const progress = 1 - (this.reappearTimer / 0.7); // 0 → 1 as block fades in
            ctx.globalAlpha = progress;
        }

        // Yellow-gold body
        ctx.fillStyle = '#FFE066';
        ctx.fillRect(x, y, this.width, this.height);

        // Darker bottom edge
        ctx.fillStyle = '#CCA800';
        ctx.fillRect(x, y + this.height - 4, this.width, 4);

        // Lighter top highlight
        ctx.fillStyle = '#FFF176';
        ctx.fillRect(x, y, this.width, 4);

        // Diagonal crack lines to indicate fragility
        ctx.strokeStyle = 'rgba(80, 60, 0, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // First crack: top-left to bottom-right area
        ctx.moveTo(x + this.width * 0.25, y + 4);
        ctx.lineTo(x + this.width * 0.55, y + this.height - 4);
        ctx.stroke();

        ctx.beginPath();
        // Second crack: slightly offset
        ctx.moveTo(x + this.width * 0.55, y + 4);
        ctx.lineTo(x + this.width * 0.85, y + this.height - 4);
        ctx.stroke();

        ctx.restore();
    }

    drawSlime(ctx, x, y) {
        // Teal gel body
        ctx.fillStyle = '#26C6DA';
        ctx.fillRect(x, y + 6, this.width, this.height - 6);

        // Darker bottom edge
        ctx.fillStyle = '#00838F';
        ctx.fillRect(x, y + this.height - 4, this.width, 4);

        // Wobbly top surface — filled sine-wave blob path
        const now = performance.now() * 0.003;
        ctx.fillStyle = '#80DEEA';
        ctx.beginPath();
        ctx.moveTo(x, y + 6);
        for (let px = 0; px <= this.width; px += 2) {
            const wobbleY = y + 6 - Math.sin(now + px * 0.18) * 6;
            ctx.lineTo(x + px, wobbleY);
        }
        ctx.lineTo(x + this.width, y + 6);
        ctx.lineTo(x + this.width, y);
        ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();

        // Small white bubble highlights
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(x + this.width * 0.3, y + 14, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x + this.width * 0.65, y + 18, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    drawConveyor(ctx, x, y) {
        // Dark gray body
        ctx.fillStyle = '#546E7A';
        ctx.fillRect(x, y, this.width, this.height);

        // Darker bottom strip
        ctx.fillStyle = '#37474F';
        ctx.fillRect(x, y + this.height - 4, this.width, 4);

        // Dark top strip
        ctx.fillStyle = '#455A64';
        ctx.fillRect(x, y, this.width, 5);

        // Animated belt: clip to block, draw scrolling diagonal stripes
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y + 5, this.width, this.height - 9);
        ctx.clip();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 6;
        const stripeSpacing = 18;
        const offset = this.conveyorOffset;
        for (let sx = x - stripeSpacing + (offset % stripeSpacing); sx < x + this.width + this.height; sx += stripeSpacing) {
            ctx.beginPath();
            ctx.moveTo(sx, y + 5);
            ctx.lineTo(sx - this.height, y + this.height - 4);
            ctx.stroke();
        }

        ctx.restore();

        // Direction arrows spaced every 24px
        const arrowChar = this.direction === 1 ? '\u25B6' : '\u25C0';
        ctx.fillStyle = this.direction === 1 ? '#4FC3F7' : '#F48FB1';
        ctx.font = 'bold 9px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const arrowY = y + 12;
        const arrowSpacing = 24;
        for (let ax = x + 12; ax < x + this.width - 8; ax += arrowSpacing) {
            ctx.fillText(arrowChar, ax, arrowY);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    drawMagma(ctx, x, y) {
        ctx.save();

        // Glowing orange glow behind the block
        ctx.shadowColor = '#FF5722';
        ctx.shadowBlur = 12;

        // Dark red body
        ctx.fillStyle = '#C62828';
        ctx.fillRect(x, y, this.width, this.height);

        ctx.shadowBlur = 0;

        // Vertical crack lines every ~(width/4)px
        ctx.strokeStyle = '#B71C1C';
        ctx.lineWidth = 2;
        const crackSpacing = Math.max(this.width / 4, 1);
        for (let cx = x + crackSpacing; cx < x + this.width - 2; cx += crackSpacing) {
            ctx.beginPath();
            ctx.moveTo(cx, y + 4);
            ctx.lineTo(cx - 2, y + this.height / 2);
            ctx.lineTo(cx + 1, y + this.height);
            ctx.stroke();
        }

        // Animated lava surface at top
        const now = performance.now() * 0.004;
        ctx.fillStyle = '#EF5350';
        ctx.beginPath();
        ctx.moveTo(x, y + 10);
        for (let px = 0; px <= this.width; px += 2) {
            const lavaY = y + 6 - Math.sin(now + px * 0.15) * 5 - Math.sin(now * 1.3 + px * 0.08) * 3;
            ctx.lineTo(x + px, lavaY);
        }
        ctx.lineTo(x + this.width, y + 10);
        ctx.closePath();
        ctx.fill();

        // Bright yellow-orange pulsing spots on surface
        const pulse = 0.4 + Math.sin(performance.now() * 0.005) * 0.3;
        ctx.fillStyle = '#FFCC02';
        ctx.globalAlpha = pulse;

        ctx.beginPath();
        ctx.arc(x + this.width * 0.22, y + 5, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x + this.width * 0.55, y + 4, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x + this.width * 0.8, y + 6, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    drawDirt(ctx, x, y) {
        // Brown body with subtle shadow
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(x, y + 6, this.width, this.height - 6);

        // Darker bottom edge
        ctx.fillStyle = '#6B4F12';
        ctx.fillRect(x, y + this.height - 4, this.width, 4);

        // Green grass top
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(x, y, this.width, 8);

        // Lighter grass highlight
        ctx.fillStyle = '#66BB6A';
        ctx.fillRect(x + 2, y, this.width - 4, 4);

        // Grass tufts
        ctx.fillStyle = '#388E3C';
        for (let i = 0; i < this.width; i += 12) {
            ctx.fillRect(x + i, y - 2, 3, 4);
            ctx.fillRect(x + i + 6, y - 1, 2, 3);
        }

        // Subtle side shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x, y, 3, this.height);
        ctx.fillRect(x + this.width - 3, y, 3, this.height);
    }

    drawCheckpointFlag(ctx, x, y) {
        const flagX = x + this.width / 2;
        const flagY = y - 40;

        const now = performance.now() / 1000;
        const timeSince = this.activatedTime !== null
            ? (performance.now() - this.activatedTime) / 1000
            : Infinity;
        const activated = this.activatedTime !== null;

        // Glowing halo when recently activated (within 2 seconds)
        if (activated && timeSince < 2.0) {
            const fadeAlpha = (1 - timeSince / 2.0) * 0.6;
            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.shadowColor = '#FF5722';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#FF8A65';
            ctx.beginPath();
            ctx.arc(flagX, flagY + 8, 28, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Pole
        ctx.strokeStyle = activated ? '#FFD700' : '#DDD';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(flagX, y);
        ctx.lineTo(flagX, flagY);
        ctx.stroke();

        // Flag — pulse scale when activated
        let scale = 1;
        if (activated) {
            scale = 1 + Math.sin(performance.now() * 0.006) * 0.15;
        }

        ctx.save();
        ctx.translate(flagX, flagY);
        ctx.scale(scale, scale);

        // Flag triangle
        ctx.fillStyle = activated ? '#FFD700' : '#FF5722';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(16, 8);
        ctx.lineTo(0, 16);
        ctx.closePath();
        ctx.fill();

        // Flag highlight
        ctx.fillStyle = activated ? '#FFF59D' : '#FF8A65';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, 5);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    drawFinishFlag(ctx, x, y) {
        const centerX = x + this.width / 2;
        const poleTopY = y - 60;
        const poleBottomY = y;

        // Tall gold pole
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, poleBottomY);
        ctx.lineTo(centerX, poleTopY);
        ctx.stroke();

        // Checkerboard banner — 2 rows × 3 cols of 8×8 squares
        const bannerX = centerX + 2;
        const bannerY = poleTopY;
        const sqSize = 8;
        const cols = 3;
        const rows = 2;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const isWhite = (row + col) % 2 === 0;
                ctx.fillStyle = isWhite ? '#FFFFFF' : '#000000';
                ctx.fillRect(
                    bannerX + col * sqSize,
                    bannerY + row * sqSize,
                    sqSize,
                    sqSize
                );
            }
        }

        // "FINISH" label below the banner
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 4;
        ctx.fillText('FINISH', centerX + (cols * sqSize) / 2, poleTopY + rows * sqSize + 12);
        ctx.restore();
    }

    drawBounce(ctx, x, y) {
        const now = performance.now() * 0.005;

        // Bright lime-green body
        ctx.fillStyle = '#76FF03';
        ctx.fillRect(x, y + 8, this.width, this.height - 8);

        // Darker bottom edge
        ctx.fillStyle = '#33691E';
        ctx.fillRect(x, y + this.height - 4, this.width, 4);

        // Animated bouncy top surface (larger amplitude than regular slime)
        ctx.fillStyle = '#CCFF90';
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        for (let px = 0; px <= this.width; px += 2) {
            const waveY = y + 8 - Math.abs(Math.sin(now + px * 0.22)) * 10;
            ctx.lineTo(x + px, waveY);
        }
        ctx.lineTo(x + this.width, y + 8);
        ctx.lineTo(x + this.width, y);
        ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();

        // Pulsing upward arrow to hint behaviour
        const pulse = 0.55 + Math.abs(Math.sin(now * 0.9)) * 0.45;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#1B5E20';
        ctx.font = `bold ${Math.min(14, this.width * 0.28)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↑', x + this.width / 2, y + this.height / 2 + 3);
        ctx.restore();
    }

    drawMoving(ctx, x, y) {
        const t = performance.now() * 0.001;

        // Indigo/purple body
        ctx.fillStyle = '#3949AB';
        ctx.fillRect(x, y + 5, this.width, this.height - 5);

        // Darker bottom edge
        ctx.fillStyle = '#283593';
        ctx.fillRect(x, y + this.height - 4, this.width, 4);

        // Lighter top strip
        ctx.fillStyle = '#5C6BC0';
        ctx.fillRect(x, y, this.width, 7);

        // Animated shimmer line scrolling across the top
        const shimmerX = x + ((t * 60 * Math.sign(this.dx || 1)) % this.width + this.width) % this.width;
        const shimmerGrad = ctx.createLinearGradient(shimmerX - 20, 0, shimmerX + 20, 0);
        shimmerGrad.addColorStop(0, 'rgba(255,255,255,0)');
        shimmerGrad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        shimmerGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, this.width, 7);
        ctx.clip();
        ctx.fillStyle = shimmerGrad;
        ctx.fillRect(shimmerX - 20, y, 40, 7);
        ctx.restore();

        // Double-headed arrow ↔ centered on the surface
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `bold ${Math.min(12, this.width * 0.2)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↔', x + this.width / 2, y + this.height / 2 + 2);
        ctx.restore();

        // Subtle side shadows
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x, y, 3, this.height);
        ctx.fillRect(x + this.width - 3, y, 3, this.height);
    }
}
