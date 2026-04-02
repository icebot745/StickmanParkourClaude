// blocks.js — Block types, behaviors, rendering

const BlockType = {
    DIRT: 'dirt',
    DISAPPEARING: 'disappearing',
    SLIME: 'slime',
    CONVEYOR: 'conveyor',
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
        this.blockIndex = 0;
    }

    draw(ctx, cameraX) {
        if (!this.active) return;

        const screenX = this.x - cameraX;
        const screenY = this.y;

        // Skip drawing if off screen
        if (screenX + this.width < -50 || screenX > ctx.canvas.width + 50) return;

        this.drawDirt(ctx, screenX, screenY);

        if (this.checkpoint) {
            this.drawCheckpointFlag(ctx, screenX, screenY);
        }
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

        // Pole
        ctx.strokeStyle = '#DDD';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(flagX, y);
        ctx.lineTo(flagX, flagY);
        ctx.stroke();

        // Flag triangle
        ctx.fillStyle = '#FF5722';
        ctx.beginPath();
        ctx.moveTo(flagX, flagY);
        ctx.lineTo(flagX + 16, flagY + 8);
        ctx.lineTo(flagX, flagY + 16);
        ctx.closePath();
        ctx.fill();

        // Flag highlight
        ctx.fillStyle = '#FF8A65';
        ctx.beginPath();
        ctx.moveTo(flagX, flagY);
        ctx.lineTo(flagX + 10, flagY + 5);
        ctx.lineTo(flagX, flagY + 8);
        ctx.closePath();
        ctx.fill();
    }
}
