// game.js — Game loop, state machine, camera

const Game = {
    canvas: null,
    ctx: null,
    state: 'start', // start, playing, dead
    cameraX: 0,
    blocks: [],
    player: null,
    lastTime: 0,
    deadTimer: 0,
    lastCheckpointBlock: null, // the block the player last touched a checkpoint on

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        Input.init();
        this.setupLevel();

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    setupLevel() {
        this.blocks = Level.generate(this.canvas.height);
        this.lastCheckpointBlock = null;

        // Player starts on first block
        const firstBlock = this.blocks[0];
        this.player = new Player(
            firstBlock.x + 20,
            firstBlock.y - 40
        );
    },

    startGame() {
        this.state = 'playing';
        this.setupLevel();
        this.cameraX = 0;
    },

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        this.update(dt);
        this.render();

        Input.clearFrame();
        requestAnimationFrame((t) => this.loop(t));
    },

    update(dt) {
        if (this.state === 'start') {
            if (Input.jump || Input.wasPressed('Enter')) {
                this.startGame();
            }
            return;
        }

        if (this.state === 'dead') {
            this.deadTimer -= dt;
            if (this.deadTimer <= 0) {
                this.state = 'playing';
                this.player.respawn();
            }
            return;
        }

        // Playing state
        const fell = this.player.update(dt, this.blocks);

        if (fell) {
            this.state = 'dead';
            this.deadTimer = 0.8;
        }

        // Check checkpoint touches
        this.checkCheckpoints();

        // Camera follows player horizontally with lookahead
        const targetCameraX = this.player.x - this.canvas.width * 0.35;
        this.cameraX += (targetCameraX - this.cameraX) * 0.08;
        if (this.cameraX < 0) this.cameraX = 0;
    },

    checkCheckpoints() {
        for (const block of this.blocks) {
            if (!block.checkpoint) continue;
            if (block === this.lastCheckpointBlock) continue;

            // Check if player is standing on this block
            const onBlock = (
                this.player.onGround &&
                this.player.x + this.player.width > block.x &&
                this.player.x < block.x + block.width &&
                Math.abs((this.player.y + this.player.height) - block.y) < 4
            );

            if (onBlock) {
                this.lastCheckpointBlock = block;
                this.player.setSpawn(block.x + 20, block.y - 40);
            }
        }
    },

    // Returns the highest block index the player has reached
    getPlayerProgress() {
        let best = 0;
        for (const block of this.blocks) {
            if (!block.active) continue;
            // Check horizontal overlap with player (generous range)
            if (this.player.x + this.player.width > block.x &&
                this.player.x < block.x + block.width + 80) {
                if (block.blockIndex > best) best = block.blockIndex;
            }
        }
        return best + 1; // 1-indexed for display
    },

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        skyGrad.addColorStop(0, '#87CEEB');
        skyGrad.addColorStop(0.6, '#E0F0FF');
        skyGrad.addColorStop(1, '#FFD4A8');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Void (below blocks area)
        const voidY = h * 0.85;
        const voidGrad = ctx.createLinearGradient(0, voidY, 0, h);
        voidGrad.addColorStop(0, 'rgba(20, 10, 30, 0.3)');
        voidGrad.addColorStop(1, 'rgba(10, 5, 20, 0.9)');
        ctx.fillStyle = voidGrad;
        ctx.fillRect(0, voidY, w, h - voidY);

        // Distant mountains (parallax)
        this.drawMountains(ctx, w, h);

        if (this.state === 'start') {
            this.drawStartScreen(ctx, w, h);
            return;
        }

        // Draw blocks
        for (const block of this.blocks) {
            block.draw(ctx, this.cameraX);
        }

        // Draw player
        if (this.state !== 'dead') {
            this.player.draw(ctx, this.cameraX);
        } else {
            // Death flash
            ctx.fillStyle = `rgba(255, 80, 50, ${this.deadTimer * 0.5})`;
            ctx.fillRect(0, 0, w, h);
        }

        // HUD
        this.drawHUD(ctx, w);
    },

    drawMountains(ctx, w, h) {
        const parallax = this.cameraX * 0.1;
        ctx.fillStyle = 'rgba(100, 130, 170, 0.25)';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.55);
        for (let x = 0; x <= w; x += 60) {
            const mountainY = h * 0.55 - Math.sin((x + parallax) * 0.008) * 60 - Math.sin((x + parallax) * 0.003) * 40;
            ctx.lineTo(x, mountainY);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(80, 110, 150, 0.2)';
        const parallax2 = this.cameraX * 0.15;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.6);
        for (let x = 0; x <= w; x += 40) {
            const mountainY = h * 0.6 - Math.sin((x + parallax2) * 0.012) * 45 - Math.sin((x + parallax2) * 0.005) * 30;
            ctx.lineTo(x, mountainY);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
    },

    drawStartScreen(ctx, w, h) {
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 48px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.fillText('PARKOUR VOID RUNNER', w / 2, h * 0.35);

        ctx.font = '20px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('Navigate 200 floating blocks. Don\'t fall into the void.', w / 2, h * 0.42);

        const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText('Press SPACE or ENTER to Start', w / 2, h * 0.55);

        ctx.font = '16px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Arrow Keys / WASD to move  •  UP / SPACE to jump', w / 2, h * 0.65);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
    },

    drawHUD(ctx, w) {
        // Top bar background
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, w, 44);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';

        // Progress: Block X / 200
        const progress = this.state === 'playing' ? this.getPlayerProgress() : 1;
        const total = Level.TOTAL_BLOCKS;

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillText(`Block  ${progress} / ${total}`, 15, 28);

        // Progress bar
        const barX = 160;
        const barW = Math.min(w - 340, 400);
        const barH = 10;
        const barY = 17;
        const fill = progress / total;

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 5);
        ctx.fill();

        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * fill, barH, 5);
        ctx.fill();

        // Checkpoint indicator on the right
        const checkpointNums = [1, 2, 3, 4];
        const checkpointBlocks = Level.CHECKPOINT_INDICES;
        ctx.font = '13px Arial, sans-serif';
        ctx.textAlign = 'right';

        let checkpointsReached = 0;
        if (this.lastCheckpointBlock) {
            checkpointsReached = checkpointBlocks.filter(
                idx => idx <= this.lastCheckpointBlock.blockIndex
            ).length;
        }

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Checkpoints:', w - 110, 22);

        for (let i = 0; i < 4; i++) {
            const cx = w - 95 + i * 22;
            const cy = 22;
            ctx.beginPath();
            ctx.arc(cx, cy - 5, 7, 0, Math.PI * 2);
            ctx.fillStyle = i < checkpointsReached ? '#FF5722' : 'rgba(255,255,255,0.2)';
            ctx.fill();
            ctx.strokeStyle = i < checkpointsReached ? '#FF8A65' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.textAlign = 'left';

        // Death message
        if (this.state === 'dead') {
            ctx.textAlign = 'center';
            ctx.font = 'bold 20px Arial, sans-serif';
            ctx.fillStyle = '#FF5722';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 8;
            const respawnMsg = this.lastCheckpointBlock
                ? 'Respawning at checkpoint...'
                : 'Respawning at start...';
            ctx.fillText('FELL INTO THE VOID!', this.canvas.width / 2, this.canvas.height / 2 - 16);
            ctx.font = '16px Arial, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(respawnMsg, this.canvas.width / 2, this.canvas.height / 2 + 12);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
        }
    },
};