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
        this.blocks = [];
        // Phase 1: hand-placed ~20 blocks for testing
        const startY = this.canvas.height * 0.65;
        let x = 50;

        // Starting platform (wider)
        this.blocks.push(new Block(x, startY, 120, 30));

        x += 170;
        for (let i = 0; i < 19; i++) {
            const width = 60 + Math.random() * 60;
            const gap = 40 + Math.random() * 80;
            const heightOffset = (Math.random() - 0.5) * 80;
            const y = Math.max(200, Math.min(startY + heightOffset, this.canvas.height - 100));

            this.blocks.push(new Block(x, y, width, 30));
            x += width + gap;
        }

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

        // Camera follows player horizontally with lookahead
        const targetCameraX = this.player.x - this.canvas.width * 0.35;
        this.cameraX += (targetCameraX - this.cameraX) * 0.08;
        if (this.cameraX < 0) this.cameraX = 0;
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

        // Closer mountain range
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
        // Title
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 48px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.fillText('PARKOUR VOID RUNNER', w / 2, h * 0.35);

        // Subtitle
        ctx.font = '20px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('Navigate the floating blocks. Don\'t fall into the void.', w / 2, h * 0.42);

        // Start prompt (pulsing)
        const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText('Press SPACE or ENTER to Start', w / 2, h * 0.55);

        // Controls
        ctx.font = '16px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Arrow Keys / WASD to move  •  UP / SPACE to jump', w / 2, h * 0.65);

        ctx.shadowBlur = 0;
    },

    drawHUD(ctx, w) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, w, 40);

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Phase 1 — Test Level', 15, 26);

        if (this.state === 'dead') {
            ctx.textAlign = 'center';
            ctx.font = 'bold 20px Arial, sans-serif';
            ctx.fillStyle = '#FF5722';
            ctx.fillText('FELL INTO THE VOID!', this.canvas.width / 2, this.canvas.height / 2);
        }
    },
};
