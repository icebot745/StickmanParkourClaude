// game.js — Game loop, state machine, camera

const Game = {
    canvas: null,
    ctx: null,
    state: 'start', // start, playing, dead, complete, gameover
    cameraX: 0,
    blocks: [],
    player: null,
    lastTime: 0,
    deadTimer: 0,
    lastCheckpointBlock: null, // the block the player last touched a checkpoint on
    checkpointFlashTimer: 0,
    timeLeft: 600,   // 10-minute countdown in seconds
    finalScore: 0,   // seconds remaining when level is completed
    // Screen shake
    screenShakeTimer: 0,
    screenShakeMag: 0,

    // Timer beep tracking
    lastTimerBeep: -1,

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
        this.checkpointFlashTimer = 0;
        this.timeLeft = 600;
        this.finalScore = 0;
        this.screenShakeTimer = 0;
        this.screenShakeMag = 0;
        this.lastTimerBeep = -1;
        Particles.clear();

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
        this.timeLeft = 600;
        this.finalScore = 0;
    },

    addScreenShake(mag, dur) {
        this.screenShakeMag   = Math.max(this.screenShakeMag, mag);
        this.screenShakeTimer = Math.max(this.screenShakeTimer, dur);
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

        // Particles and screen shake run in all non-start states
        Particles.update(dt);
        if (this.screenShakeTimer > 0) {
            this.screenShakeTimer -= dt;
            if (this.screenShakeTimer <= 0) this.screenShakeMag = 0;
        }

        if (this.state === 'complete') {
            if (Input.jump || Input.wasPressed('Enter') || Input.wasPressed('KeyR')) {
                this.startGame();
            }
            return;
        }

        if (this.state === 'gameover') {
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

        // Decrement checkpoint flash timer
        this.checkpointFlashTimer = Math.max(0, this.checkpointFlashTimer - dt);

        // Countdown timer
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.state = 'gameover';
            Sound.death();
            return;
        }

        // Warning beep every second when under 30 s
        if (this.timeLeft < 30) {
            const beepAt = Math.ceil(this.timeLeft);
            if (beepAt !== this.lastTimerBeep) {
                this.lastTimerBeep = beepAt;
                Sound.timerWarning();
            }
        }

        // Playing state
        const fell = this.player.update(dt, this.blocks);

        // Update block states
        for (const block of this.blocks) {
            block.update(dt);
        }

        if (fell) {
            this.state = 'dead';
            this.deadTimer = 0.8;
            Sound.death();
            Particles.death(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
            this.addScreenShake(10, 0.4);
            return;
        }

        // Check checkpoint touches
        this.checkCheckpoints();

        // Win detection: player is on ground and overlaps the last block's center-to-right half
        const lastBlock = this.blocks[this.blocks.length - 1];
        if (lastBlock && this.player.onGround) {
            const blockCenterX = lastBlock.x + lastBlock.width / 2;
            const playerOverlapsRight = (
                this.player.x + this.player.width > blockCenterX &&
                this.player.x < lastBlock.x + lastBlock.width &&
                Math.abs((this.player.y + this.player.height) - lastBlock.y) < 4
            );
            if (playerOverlapsRight) {
                this.finalScore = Math.floor(this.timeLeft);
                this.state = 'complete';
                Sound.complete();
                Particles.complete(this.player.x, this.canvas.height / 2, this.canvas.width);
            }
        }

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
                block.activatedTime = performance.now();
                this.checkpointFlashTimer = 1.5;
                Sound.checkpoint();
                Particles.checkpoint(block.x + block.width / 2, block.y);
            }
        }
    },

    // Returns the highest block index the player has reached
    getPlayerProgress() {
        if (this.state !== 'playing' && this.state !== 'dead' && this.state !== 'complete' && this.state !== 'gameover') {
            return 1;
        }
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

        // --- World layer (with screen shake) ---
        const shakeX = this.screenShakeTimer > 0 ? (Math.random() - 0.5) * this.screenShakeMag * 2 : 0;
        const shakeY = this.screenShakeTimer > 0 ? (Math.random() - 0.5) * this.screenShakeMag * 2 : 0;
        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Draw blocks
        for (const block of this.blocks) {
            block.draw(ctx, this.cameraX);
        }

        // Draw player
        if (this.state !== 'dead') {
            this.player.draw(ctx, this.cameraX);
        }

        // Draw particles (world-space, behind UI)
        Particles.draw(ctx, this.cameraX);

        ctx.restore();

        // Death flash overlay (no shake — keeps UI readable)
        if (this.state === 'dead') {
            ctx.fillStyle = `rgba(255, 80, 50, ${this.deadTimer * 0.5})`;
            ctx.fillRect(0, 0, w, h);
        }

        // Checkpoint banner (while playing)
        if (this.checkpointFlashTimer > 0 && this.state === 'playing') {
            this.drawCheckpointBanner(ctx, w, h);
        }

        // Complete screen
        if (this.state === 'complete') {
            this.drawCompleteScreen(ctx, w, h);
        }

        // Game over screen
        if (this.state === 'gameover') {
            this.drawGameOverScreen(ctx, w, h);
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
        ctx.fillText('Navigate 100 blocks in 10 minutes. Don\'t fall into the void.', w / 2, h * 0.42);

        const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText('Press SPACE or ENTER to Start', w / 2, h * 0.55);

        ctx.font = '16px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Move: Arrow Keys / WASD  \u2022  Jump: UP / SPACE  \u2022  Roll: DOWN (10s speed boost)', w / 2, h * 0.65);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
    },

    drawCompleteScreen(ctx, w, h) {
        // Semi-transparent dark overlay
        ctx.fillStyle = 'rgba(0, 20, 40, 0.75)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 12;

        // Gold title
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 56px Arial, sans-serif';
        ctx.fillText('YOU MADE IT!', w / 2, h * 0.35);

        // Subtitle
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '22px Arial, sans-serif';
        ctx.fillText('You navigated all 100 blocks!', w / 2, h * 0.44);

        // Checkpoints stat
        const checkpointsReached = this.lastCheckpointBlock
            ? Level.CHECKPOINT_INDICES.filter(idx => idx <= this.lastCheckpointBlock.blockIndex).length
            : 0;
        ctx.fillStyle = '#FF8A65';
        ctx.font = '20px Arial, sans-serif';
        ctx.fillText(`Checkpoints hit: ${checkpointsReached} / ${Level.CHECKPOINT_INDICES.length}`, w / 2, h * 0.52);

        // Score display
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.fillText(`SCORE: ${this.finalScore} seconds`, w / 2, h * 0.58);

        // Score descriptor
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '15px Arial, sans-serif';
        ctx.fillText(`${this.finalScore} seconds remaining out of 600`, w / 2, h * 0.63);

        // Pulsing play again prompt
        const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText('Press SPACE or ENTER to Play Again', w / 2, h * 0.72);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
    },

    drawCheckpointBanner(ctx, w, h) {
        // Compute which checkpoint number was just hit
        let checkpointNum = 0;
        if (this.lastCheckpointBlock) {
            checkpointNum = Level.CHECKPOINT_INDICES.filter(
                idx => idx <= this.lastCheckpointBlock.blockIndex
            ).length;
        }

        // Alpha fades out when timer < 0.5
        const alpha = this.checkpointFlashTimer < 0.5
            ? this.checkpointFlashTimer / 0.5
            : 1.0;

        const boxW = 300;
        const boxH = 64;
        const boxX = (w - boxW) / 2;
        const boxY = h * 0.2;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Dark orange translucent box
        ctx.fillStyle = 'rgba(180, 60, 10, 0.78)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 10);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(255, 180, 80, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;

        // Main text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillText(`\u2713 CHECKPOINT ${checkpointNum} / ${Level.CHECKPOINT_INDICES.length}`, w / 2, boxY + 26);

        // Sub text
        ctx.fillStyle = 'rgba(255,220,180,0.9)';
        ctx.font = '14px Arial, sans-serif';
        ctx.fillText('Respawn point saved', w / 2, boxY + 48);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
        ctx.restore();
    },

    drawGameOverScreen(ctx, w, h) {
        // Dark red overlay
        ctx.fillStyle = 'rgba(20, 0, 0, 0.82)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.shadowColor = '#FF1744';
        ctx.shadowBlur = 24;

        // Title
        ctx.fillStyle = '#FF5252';
        ctx.font = 'bold 62px Arial, sans-serif';
        ctx.fillText("TIME'S UP!", w / 2, h * 0.34);

        ctx.shadowBlur = 0;

        // Subtitle
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '22px Arial, sans-serif';
        ctx.fillText('You ran out of time!', w / 2, h * 0.44);

        // Progress reached
        const progress = this.getPlayerProgress();
        ctx.fillStyle = '#FF8A65';
        ctx.font = '18px Arial, sans-serif';
        ctx.fillText(`Reached block ${progress} / ${Level.TOTAL_BLOCKS}`, w / 2, h * 0.52);

        // Tip about rolling
        ctx.fillStyle = 'rgba(0, 229, 255, 0.75)';
        ctx.font = '15px Arial, sans-serif';
        ctx.fillText('Tip: Press DOWN to activate a 10s speed boost!', w / 2, h * 0.60);

        // Restart prompt (pulsing)
        const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText('Press SPACE or ENTER to Try Again', w / 2, h * 0.70);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
    },

    drawHUD(ctx, w) {
        // Top bar background
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, w, 44);

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';

        // Progress: Block X / total
        const progress = (this.state === 'playing' || this.state === 'dead' || this.state === 'complete' || this.state === 'gameover')
            ? this.getPlayerProgress()
            : 1;
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

        // Gold bar when complete, green otherwise
        ctx.fillStyle = this.state === 'complete' ? '#FFD700' : '#4CAF50';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * fill, barH, 5);
        ctx.fill();

        // Timer — center of bar
        const mins = Math.floor(this.timeLeft / 60);
        const secs = Math.floor(this.timeLeft % 60);
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        let timerColor = '#69F0AE';          // green (> 2 min)
        if (this.timeLeft < 120) timerColor = '#FFD740'; // yellow
        if (this.timeLeft < 30)  timerColor = '#FF5252'; // red

        // Pulse red when < 30s
        let timerAlpha = 1;
        if (this.timeLeft < 30) timerAlpha = 0.6 + Math.sin(performance.now() * 0.012) * 0.4;

        ctx.save();
        ctx.globalAlpha = timerAlpha;
        ctx.fillStyle = timerColor;
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(timeStr, w / 2, 30);
        ctx.restore();

        // Checkpoint indicator on the right
        const checkpointBlocks = Level.CHECKPOINT_INDICES;
        ctx.font = '13px Arial, sans-serif';
        ctx.textAlign = 'right';

        let checkpointsReached = 0;
        if (this.lastCheckpointBlock) {
            checkpointsReached = checkpointBlocks.filter(
                idx => idx <= this.lastCheckpointBlock.blockIndex
            ).length;
        }

        const numCPs = Level.CHECKPOINT_INDICES.length;
        const dotR = 5;
        const dotSpacing = 14;
        const dotsWidth = (numCPs - 1) * dotSpacing;

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Checkpoints:', w - dotsWidth - 24, 22);

        for (let i = 0; i < numCPs; i++) {
            const cx = w - dotsWidth - 10 + i * dotSpacing;
            const cy = 17;
            ctx.beginPath();
            ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
            ctx.fillStyle = i < checkpointsReached ? '#FF5722' : 'rgba(255,255,255,0.2)';
            ctx.fill();
            ctx.strokeStyle = i < checkpointsReached ? '#FF8A65' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.textAlign = 'left';

        // Roll indicator below the timer bar (y=60)
        if (Game.player) {
            const p = Game.player;
            if (p.rollTimer > 0) {
                ctx.save();
                ctx.fillStyle = '#00E5FF';
                ctx.font = 'bold 13px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`\u26A1 ROLL ${Math.ceil(p.rollTimer)}s`, w / 2, 44 + 16);
                ctx.restore();
            } else if (p.rollCooldown > 0) {
                ctx.save();
                ctx.fillStyle = 'rgba(0,180,210,0.65)';
                ctx.font = 'bold 13px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`ROLL COOLDOWN ${Math.ceil(p.rollCooldown)}s`, w / 2, 44 + 16);
                ctx.restore();
            }
        }

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
