// game.js — Game loop, state machine, camera

// ── High Scores ───────────────────────────────────────────────────────────────
const HighScores = (() => {
    const KEY = 'pvr_highscores';
    const MAX = 5;

    function load() {
        try { return JSON.parse(localStorage.getItem(KEY)) || []; }
        catch { return []; }
    }

    return {
        add(score) {
            const list = load();
            list.push({ score, date: new Date().toLocaleDateString() });
            list.sort((a, b) => b.score - a.score);
            list.splice(MAX);
            try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
        },
        getAll() { return load(); },
    };
})();

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

    // How-to overlay
    howToVisible: false,
    _howToBtn: null,

    // Settings overlay
    settingsVisible: false,
    _settingsBtn: null,
    _settingsBtns: [],   // toggle hit areas set each frame

    // In-game home button
    _homeBtn: null,

    // Shop overlay
    shopVisible: false,
    shopTab: 0,          // 0 = cosmetics, 1 = power-ups
    _shopBtn: null,
    _shopBackBtn: null,
    _shopTabBtns: [],
    _shopItemBtns: [],
    _shopFeedback: null, // { msg, timer, ok }

    // Active power-up timers (seconds)
    neutralizeTimer: 0,
    jumperTimer: 0,
    birdTimer: 0,
    _birdStartX: 0,

    // Power-up HUD click areas (rebuilt each frame by drawPowerupHUD)
    _powerupHUDBtns: [],

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Click detection for overlays and start-screen buttons
        this.canvas.addEventListener('click', (e) => {
            const r  = this.canvas.getBoundingClientRect();
            const mx = e.clientX - r.left;
            const my = e.clientY - r.top;

            // Shop overlay
            if (this.shopVisible) {
                const bb = this._shopBackBtn;
                if (bb && mx >= bb.x && mx <= bb.x + bb.w && my >= bb.y && my <= bb.y + bb.h) {
                    this.shopVisible = false; return;
                }
                for (const btn of this._shopTabBtns) {
                    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                        btn.action(); return;
                    }
                }
                for (const btn of this._shopItemBtns) {
                    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                        btn.action(); return;
                    }
                }
                return;
            }

            // Settings overlay: check toggle buttons first, else close
            if (this.settingsVisible) {
                let hit = false;
                for (const btn of this._settingsBtns) {
                    if (mx >= btn.x && mx <= btn.x + btn.w &&
                        my >= btn.y && my <= btn.y + btn.h) {
                        btn.action();
                        hit = true;
                    }
                }
                if (!hit) this.settingsVisible = false;
                return;
            }

            // How-to overlay: click anywhere to close
            if (this.howToVisible) { this.howToVisible = false; return; }

            // In-game power-up HUD slots (playing / dead)
            if (this.state === 'playing' || this.state === 'dead') {
                for (const btn of this._powerupHUDBtns) {
                    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
                        if (this.state === 'playing') this.activatePowerup(btn.id);
                        return;
                    }
                }
            }

            // In-game home button (playing / dead / complete / gameover)
            if (this.state !== 'start') {
                const hb = this._homeBtn;
                if (hb && mx >= hb.x && mx <= hb.x + hb.w && my >= hb.y && my <= hb.y + hb.h) {
                    Music.stop();
                    this.state = 'start';
                    this.setupLevel();
                    return;
                }
            }

            // Start-screen buttons
            if (this.state === 'start') {
                const hit = (b) => b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
                if (hit(this._howToBtn))     { this.howToVisible     = true; return; }
                if (hit(this._settingsBtn))  { this.settingsVisible  = true; return; }
                if (hit(this._shopBtn))      { this.shopVisible      = true; return; }
            }
        });

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
        this.neutralizeTimer = 0;
        this.jumperTimer     = 0;
        this.birdTimer       = 0;
        Music.stop();
        Music.start();
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
            if (Input.wasPressed('Escape')) {
                this.howToVisible    = false;
                this.settingsVisible = false;
                this.shopVisible     = false;
                return;
            }
            if (this.howToVisible || this.settingsVisible || this.shopVisible) return;
            if (Input.jump || Input.wasPressed('Enter')) {
                this.startGame();
            }
            return;
        }

        // ESC while in-game → return to home screen
        if (Input.wasPressed('Escape')) {
            Music.stop();
            this.state = 'start';
            this.setupLevel();
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
            Music.stop();
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

        // Power-up timers
        if (this.neutralizeTimer > 0) this.neutralizeTimer = Math.max(0, this.neutralizeTimer - dt);
        if (this.jumperTimer > 0)     this.jumperTimer     = Math.max(0, this.jumperTimer - dt);
        if (this.birdTimer > 0)       this.birdTimer       = Math.max(0, this.birdTimer - dt);
        if (this._shopFeedback)  {
            this._shopFeedback.timer -= dt;
            if (this._shopFeedback.timer <= 0) this._shopFeedback = null;
        }

        // Power-up activation (keys 1-5)
        const _puMap = [['1','bird'],['2','timer'],['3','neutralize'],['4','jumper'],['5','fifty']];
        for (const [key, id] of _puMap) {
            if (Input.wasPressed(key) && PlayerData.getPowerupCount(id) > 0) {
                this.activatePowerup(id);
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
                HighScores.add(this.finalScore);
                PlayerData.addGold(this.finalScore);
                this.state = 'complete';
                Music.stop();
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
            if (this.howToVisible)    this.drawHowToScreen(ctx, w, h);
            if (this.settingsVisible) this.drawSettingsScreen(ctx, w, h);
            if (this.shopVisible)     this.drawShopScreen(ctx, w, h);
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

        // Power-up inventory HUD (bottom of screen)
        this.drawPowerupHUD(ctx, w, h);

        // Bird visual effect
        if (this.birdTimer > 0) this.drawBirdEffect(ctx, w, h);

        // How-to overlay (drawn last so it's always on top)
        if (this.howToVisible) this.drawHowToScreen(ctx, w, h);
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
        // ── Gold display (top-right) ───────────────────────────────────────────
        const gold = PlayerData.getGold();
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur  = 6;
        ctx.fillStyle   = '#FFD700';
        ctx.fillText(`\uD83E\uDE99 ${gold.toLocaleString()} Gold`, w - 16, 28);
        ctx.shadowBlur  = 0;

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

        // Bottom buttons: [? How to Play]  [⚙ Settings]  [🛒 Shop]
        ctx.font = 'bold 16px Arial, sans-serif';
        const btnH   = 36;
        const btnY   = h * 0.73;
        const gap    = 12;

        const htpLabel  = '? How to Play';
        const setLabel  = '\u2699 Settings';
        const shopLabel = '\uD83D\uDED2 Shop';
        const htpW  = ctx.measureText(htpLabel).width + 28;
        const setW  = ctx.measureText(setLabel).width + 28;
        const shopW = ctx.measureText(shopLabel).width + 28;
        const totalW = htpW + gap + setW + gap + shopW;
        const htpX  = w / 2 - totalW / 2;
        const setX  = htpX + htpW + gap;
        const shopX = setX + setW + gap;

        this._howToBtn   = { x: htpX,  y: btnY, w: htpW,  h: btnH };
        this._settingsBtn = { x: setX,  y: btnY, w: setW,  h: btnH };
        this._shopBtn     = { x: shopX, y: btnY, w: shopW, h: btnH };

        for (const [label, bx, bw] of [[htpLabel, htpX, htpW], [setLabel, setX, setW], [shopLabel, shopX, shopW]]) {
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.roundRect(bx, btnY, bw, btnH, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.textAlign = 'center';
            ctx.fillText(label, bx + bw / 2, btnY + 23);
        }

        // ── High Scores panel ──────────────────────────────────────────────────
        const scores = HighScores.getAll();
        const panelW = 320;
        const panelX = w / 2 - panelW / 2;
        const panelY = h * 0.83;
        const rowH   = 22;
        const panelH = 28 + scores.length * rowH + (scores.length === 0 ? 24 : 0);

        // Panel background
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelW, panelH, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Panel title
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText('🏆 HIGH SCORES', w / 2, panelY + 18);

        if (scores.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.font = '13px Arial, sans-serif';
            ctx.fillText('No scores yet — complete the level!', w / 2, panelY + 18 + rowH);
        } else {
            for (let i = 0; i < scores.length; i++) {
                const entry = scores[i];
                const ey = panelY + 18 + (i + 1) * rowH;

                // Rank colour: gold / silver / bronze / white
                const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#FFFFFF', '#FFFFFF'];
                ctx.fillStyle = rankColors[i] || '#FFFFFF';
                ctx.font = `bold 13px Arial, sans-serif`;
                ctx.textAlign = 'left';
                ctx.fillText(`#${i + 1}`, panelX + 14, ey);

                // Score
                const mins = Math.floor(entry.score / 60);
                const secs = entry.score % 60;
                const timeStr = `${mins}:${secs.toString().padStart(2, '0')} remaining`;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '13px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(timeStr, w / 2 + 10, ey);

                // Date
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.font = '11px Arial, sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(entry.date, panelX + panelW - 14, ey);
            }
        }

        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
    },

    drawSettingsScreen(ctx, w, h) {
        // Dark backdrop
        ctx.fillStyle = 'rgba(0,10,30,0.88)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;

        // Title
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 32px Arial, sans-serif';
        ctx.fillText('SETTINGS', cx, h * 0.30);

        ctx.shadowBlur = 0;

        // Reset toggle areas each frame
        this._settingsBtns = [];

        const rowY1 = h * 0.46;
        const rowY2 = h * 0.58;
        this._drawToggleRow(ctx, cx, rowY1, 'Music',         Music.isEnabled(),       () => { Music.setEnabled(!Music.isEnabled()); });
        this._drawToggleRow(ctx, cx, rowY2, 'Sound Effects', Sound.isSfxEnabled(),    () => { Sound.setSfxEnabled(!Sound.isSfxEnabled()); });

        // Dismiss hint
        const pulse = 0.5 + Math.sin(performance.now() * 0.004) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.65})`;
        ctx.font = '13px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Click outside toggles or press ESC to close', cx, h * 0.90);
        ctx.textAlign = 'left';
    },

    _drawToggleRow(ctx, cx, y, label, isOn, action) {
        // Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(label, cx - 24, y + 12);

        // Toggle pill
        const tw = 88, th = 36;
        const tx = cx + 24, ty = y - 6;
        ctx.fillStyle = isOn ? '#4CAF50' : '#555';
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, th / 2);
        ctx.fill();

        // Sliding circle
        const circleX = isOn ? tx + tw - th / 2 : tx + th / 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(circleX, ty + th / 2, th / 2 - 4, 0, Math.PI * 2);
        ctx.fill();

        // ON / OFF label inside pill
        ctx.fillStyle = isOn ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isOn ? 'ON' : 'OFF', tx + tw / 2, ty + th / 2 + 4);

        // Store hit area
        this._settingsBtns.push({ x: tx, y: ty, w: tw, h: th, action });
        ctx.textAlign = 'left';
    },

    drawHowToScreen(ctx, w, h) {
        // Dark backdrop
        ctx.fillStyle = 'rgba(0,10,30,0.88)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        let y = h * 0.08;
        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 32px Arial, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.fillText('HOW TO PLAY', cx, y); y += 44;

        // ── Controls ──
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 17px Arial, sans-serif';
        ctx.fillText('Controls', cx, y); y += 6;

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - 160, y); ctx.lineTo(cx + 160, y); ctx.stroke();
        y += 20;

        const controls = [
            ['Move',   'Arrow Keys / A D'],
            ['Jump',   'Up / W / Space'],
            ['Roll',   'Down / S  (10s speed boost, 20s cooldown)'],
        ];
        ctx.font = '15px Arial, sans-serif';
        for (const [action, keys] of controls) {
            ctx.fillStyle = '#69F0AE';
            ctx.textAlign = 'right';
            ctx.fillText(action, cx - 10, y);
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.fillText(keys, cx + 10, y);
            y += 26;
        }
        y += 10;

        // ── Block Types ──
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 17px Arial, sans-serif';
        ctx.fillText('Block Types', cx, y); y += 6;
        ctx.beginPath(); ctx.moveTo(cx - 160, y); ctx.lineTo(cx + 160, y); ctx.stroke();
        y += 22;

        const blocks = [
            ['#4CAF50', 'Dirt',         'Normal platform'],
            ['#FFE066', 'Disappearing', 'Breaks after you land — reappears after 4s'],
            ['#546E7A', 'Conveyor',     'Pushes you left or right'],
            ['#C62828', 'Magma',        'Launches you forward'],
            ['#3949AB', 'Moving',       'Slides left and right — ride it'],
            ['#76FF03', 'Bounce',       'Launches you straight up'],
        ];

        const swatchSize = 16;
        const labelX = cx - 170;
        ctx.font = '14px Arial, sans-serif';
        for (const [color, name, desc] of blocks) {
            // Colour swatch
            ctx.fillStyle = color;
            ctx.fillRect(labelX, y - 13, swatchSize, swatchSize);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(labelX, y - 13, swatchSize, swatchSize);

            // Name
            ctx.fillStyle = '#FFD740';
            ctx.textAlign = 'left';
            ctx.font = 'bold 14px Arial, sans-serif';
            ctx.fillText(name, labelX + swatchSize + 8, y);

            // Description
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.font = '13px Arial, sans-serif';
            ctx.fillText(desc, labelX + swatchSize + 8 + 90, y);
            y += 26;
        }
        y += 10;

        // ── Goal ──
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '14px Arial, sans-serif';
        ctx.fillText('Goal: reach Block 100 before the 10-minute timer runs out.', cx, y);
        ctx.fillText('Checkpoints every 15 blocks save your respawn point.', cx, y + 22);

        // Dismiss hint
        const pulse = 0.5 + Math.sin(performance.now() * 0.004) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.7})`;
        ctx.font = '13px Arial, sans-serif';
        ctx.fillText('Click anywhere or press ESC to close', cx, h * 0.94);

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

        // Gold earned
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillText(`\uD83E\uDE99 +${this.finalScore} Gold earned!`, w / 2, h * 0.68);

        // Total gold
        ctx.fillStyle = 'rgba(255,215,0,0.6)';
        ctx.font = '14px Arial, sans-serif';
        ctx.fillText(`Total gold: ${PlayerData.getGold().toLocaleString()}`, w / 2, h * 0.72);

        // Pulsing play again prompt
        const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText('Press SPACE or ENTER to Play Again', w / 2, h * 0.78);

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

        // ── Home button (top-left of HUD bar) ──
        const homeBtnW = 72, homeBtnH = 28, homeBtnX = 10, homeBtnY = 8;
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.beginPath();
        ctx.roundRect(homeBtnX, homeBtnY, homeBtnW, homeBtnH, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u2302 Home', homeBtnX + homeBtnW / 2, homeBtnY + 19);
        this._homeBtn = { x: homeBtnX, y: homeBtnY, w: homeBtnW, h: homeBtnH };

        // Progress: Block X / total
        const progress = (this.state === 'playing' || this.state === 'dead' || this.state === 'complete' || this.state === 'gameover')
            ? this.getPlayerProgress()
            : 1;
        const total = this.blocks.length || Level.TOTAL_BLOCKS;

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Block  ${progress} / ${total}`, homeBtnX + homeBtnW + 12, 28);

        // Progress bar
        const barX = 210;
        const barW = Math.min(w - 390, 400);
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

        // Active power-up status strips (below roll indicator)
        {
            const strips = [];
            if (this.neutralizeTimer > 0) strips.push(`\uD83C\uDF3F NEUTRALIZE ${Math.ceil(this.neutralizeTimer)}s`);
            if (this.jumperTimer > 0)     strips.push(`\uD83E\uDD98 JUMPER ${Math.ceil(this.jumperTimer)}s`);
            if (strips.length) {
                ctx.save();
                ctx.font = 'bold 13px Arial, sans-serif';
                ctx.textAlign = 'center';
                const sx = w / 2;
                let sy = (Game.player && (Game.player.rollTimer > 0 || Game.player.rollCooldown > 0)) ? 44 + 32 : 44 + 16;
                for (const strip of strips) {
                    ctx.fillStyle = 'rgba(255,230,100,0.85)';
                    ctx.fillText(strip, sx, sy);
                    sy += 18;
                }
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

    // ── Power-up activation ───────────────────────────────────────────────────
    activatePowerup(id) {
        if (!PlayerData.usePowerup(id)) return;
        switch (id) {
            case 'bird': {
                const cur = this.getPlayerProgress() - 1;
                const ti  = Math.min(cur + 20, this.blocks.length - 1);
                const tb  = this.blocks[ti];
                if (tb) {
                    this.player.x = tb.x + 10;
                    this.player.y = tb.y - this.player.height;
                    this.player.vx = 0; this.player.vy = 0;
                    this.player.onGround = true;
                    this.cameraX = Math.max(0, this.player.x - this.canvas.width * 0.35);
                }
                this.birdTimer = 2.5;
                this._birdStartX = -80;
                break;
            }
            case 'timer':
                this.timeLeft = Math.min(this.timeLeft + 120, 600);
                break;
            case 'neutralize':
                this.neutralizeTimer = 60;
                break;
            case 'jumper':
                this.jumperTimer = 45;
                break;
            case 'fifty':
                if (this.blocks.length > 50) {
                    this.blocks = this.blocks.slice(0, 50);
                }
                break;
        }
    },

    // ── Shop overlay ─────────────────────────────────────────────────────────
    drawShopScreen(ctx, w, h) {
        ctx.fillStyle = 'rgba(0,10,30,0.93)';
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;

        // Title
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 30px Arial, sans-serif';
        ctx.fillText('\uD83D\uDED2 SHOP', cx, h * 0.07);

        // Gold display
        ctx.fillStyle = '#FFE082';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillText('\uD83E\uDE99 ' + PlayerData.getGold().toLocaleString() + ' Gold', cx, h * 0.13);
        ctx.shadowBlur = 0;

        // Feedback
        if (this._shopFeedback) {
            const alpha = Math.min(1, this._shopFeedback.timer / 0.4);
            ctx.fillStyle = this._shopFeedback.ok
                ? `rgba(100,255,100,${alpha})` : `rgba(255,100,100,${alpha})`;
            ctx.font = 'bold 14px Arial, sans-serif';
            ctx.fillText(this._shopFeedback.msg, cx, h * 0.17);
        }

        // Tabs
        this._shopTabBtns = [];
        const tabW = 130, tabH = 34, tabGap = 12;
        const tabY = h * 0.20;
        const tabStartX = cx - tabW - tabGap / 2;
        for (let i = 0; i < 2; i++) {
            const tx = tabStartX + i * (tabW + tabGap);
            const active = this.shopTab === i;
            ctx.fillStyle = active ? '#FFD700' : 'rgba(255,255,255,0.12)';
            ctx.beginPath(); ctx.roundRect(tx, tabY, tabW, tabH, 8); ctx.fill();
            ctx.strokeStyle = active ? '#FFD700' : 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = active ? '#000' : 'rgba(255,255,255,0.8)';
            ctx.font = 'bold 14px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(['Cosmetics','Power-ups'][i], tx + tabW / 2, tabY + 22);
            const ti = i;
            this._shopTabBtns.push({ x: tx, y: tabY, w: tabW, h: tabH, action: () => { this.shopTab = ti; } });
        }

        this._shopItemBtns = [];

        if (this.shopTab === 0) {
            this._drawShopCosmetics(ctx, w, h, cx);
        } else {
            this._drawShopPowerups(ctx, w, h, cx);
        }

        // Back button
        const backW = 100, backH = 34;
        const backX = cx - backW / 2, backY = h * 0.92;
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.beginPath(); ctx.roundRect(backX, backY, backW, backH, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u2190 Back', cx, backY + 22);
        this._shopBackBtn = { x: backX, y: backY, w: backW, h: backH };
        ctx.textAlign = 'left';
    },

    _drawShopCosmetics(ctx, w, h, cx) {
        const gold  = PlayerData.getGold();
        const equip = PlayerData.getEquipped();

        let y = h * 0.31;

        // Colors row
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('— COLOURS —', cx, y); y += 16;

        const colors = PlayerData.COSMETICS.filter(c => c.type === 'color');
        const cSlotW = 62, cSlotH = 76, cGap = 10;
        const rowW2 = colors.length * cSlotW + (colors.length - 1) * cGap;
        let cx0 = cx - rowW2 / 2;

        for (const item of colors) {
            const isOwned = PlayerData.isOwned(item.id);
            const isEquip = equip.color === item.id;

            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(cx0 + cSlotW / 2, y + 16, 17, 0, Math.PI * 2);
            ctx.fill();
            if (isEquip) { ctx.strokeStyle = '#FFF'; ctx.lineWidth = 3; ctx.stroke(); }

            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.font = '10px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.name, cx0 + cSlotW / 2, y + 38);

            const bx = cx0, by2 = y + 44, bw = cSlotW, bh = 22;
            let lbl, bg;
            if (isEquip)          { lbl = '\u2714 On';    bg = '#FFD700'; }
            else if (isOwned)     { lbl = 'Equip';        bg = '#1565C0'; }
            else if (gold >= item.price) { lbl = item.price + 'g'; bg = 'rgba(56,142,60,0.8)'; }
            else                  { lbl = item.price + 'g'; bg = 'rgba(80,80,80,0.7)'; }

            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.roundRect(bx, by2, bw, bh, 4); ctx.fill();
            ctx.fillStyle = (isOwned || gold >= item.price) ? (isEquip ? '#000' : '#FFF') : 'rgba(255,255,255,0.5)';
            ctx.font = 'bold 9px Arial, sans-serif';
            ctx.fillText(lbl, bx + bw / 2, by2 + 15);

            const _id = item.id;
            this._shopItemBtns.push({ x: bx, y: by2, w: bw, h: bh, action: () => {
                if (!PlayerData.isOwned(_id)) {
                    const r = PlayerData.buyCosmetic(_id);
                    this._shopFeedback = { msg: r.ok ? 'Bought ' + item.name + '!' : r.msg, timer: 2, ok: r.ok };
                    if (r.ok) PlayerData.equipCosmetic(_id);
                } else {
                    PlayerData.equipCosmetic(_id);
                }
            }});
            cx0 += cSlotW + cGap;
        }
        y += cSlotH + 10;

        // Accessories list
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('— ACCESSORIES —', cx, y); y += 16;

        const accs = PlayerData.COSMETICS.filter(c => c.type !== 'color');
        const pnlW = 360, rowH = 36;
        const pnlX = cx - pnlW / 2;

        for (const item of accs) {
            const isOwned = PlayerData.isOwned(item.id);
            const isEquip = equip[item.type] === item.id;

            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath(); ctx.roundRect(pnlX, y, pnlW, rowH - 2, 5); ctx.fill();
            if (isEquip) { ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5; ctx.stroke(); }

            ctx.fillStyle = isOwned ? '#FFD740' : 'rgba(255,255,255,0.75)';
            ctx.font = 'bold 13px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(item.name, pnlX + 12, y + 22);

            ctx.fillStyle = 'rgba(255,215,0,0.75)';
            ctx.font = '12px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.price + 'g', pnlX + pnlW - 118, y + 22);

            const bx2 = pnlX + pnlW - 94, by3 = y + 5, bw2 = 86, bh2 = 24;
            let lbl2, bg2;
            if (isEquip)          { lbl2 = '\u2714 Equipped'; bg2 = '#FFD700'; }
            else if (isOwned)     { lbl2 = 'Equip';           bg2 = '#1565C0'; }
            else if (gold >= item.price) { lbl2 = 'Buy';      bg2 = 'rgba(56,142,60,0.8)'; }
            else                  { lbl2 = 'Buy';             bg2 = 'rgba(80,80,80,0.7)'; }

            ctx.fillStyle = bg2;
            ctx.beginPath(); ctx.roundRect(bx2, by3, bw2, bh2, 5); ctx.fill();
            ctx.fillStyle = isEquip ? '#000' : '#FFF';
            ctx.font = 'bold 10px Arial, sans-serif';
            ctx.fillText(lbl2, bx2 + bw2 / 2, by3 + 16);

            const _id2 = item.id;
            this._shopItemBtns.push({ x: bx2, y: by3, w: bw2, h: bh2, action: () => {
                if (!PlayerData.isOwned(_id2)) {
                    const r = PlayerData.buyCosmetic(_id2);
                    this._shopFeedback = { msg: r.ok ? 'Bought ' + item.name + '!' : r.msg, timer: 2, ok: r.ok };
                    if (r.ok) PlayerData.equipCosmetic(_id2);
                } else {
                    PlayerData.equipCosmetic(_id2);
                }
            }});
            y += rowH;
        }
    },

    _drawShopPowerups(ctx, w, h, cx) {
        const gold = PlayerData.getGold();
        let y = h * 0.31;
        const pnlW = Math.min(w - 60, 440), rowH = 78;
        const pnlX = cx - pnlW / 2;

        for (const pu of PlayerData.POWERUPS) {
            const count  = PlayerData.getPowerupCount(pu.id);
            const canBuy = gold >= pu.price;

            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath(); ctx.roundRect(pnlX, y, pnlW, rowH - 6, 8); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();

            // Icon
            ctx.font = '22px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#FFF';
            ctx.fillText(pu.icon, pnlX + 10, y + 30);

            // Name + desc + key hint
            ctx.font = 'bold 13px Arial, sans-serif';
            ctx.fillStyle = '#FFD740';
            ctx.fillText(pu.name, pnlX + 42, y + 22);
            ctx.font = '10px Arial, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(pu.desc, pnlX + 42, y + 36);
            ctx.fillStyle = 'rgba(0,229,255,0.75)';
            ctx.fillText('[' + pu.key + '] to activate in-game', pnlX + 42, y + 50);

            // Owned count
            ctx.font = 'bold 13px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = count > 0 ? '#69F0AE' : 'rgba(255,255,255,0.3)';
            ctx.fillText('x' + count, pnlX + pnlW - 152, y + 33);

            // Price
            ctx.fillStyle = 'rgba(255,215,0,0.8)';
            ctx.font = '11px Arial, sans-serif';
            ctx.fillText(pu.price + 'g', pnlX + pnlW - 104, y + 33);

            // Buy button
            const bx = pnlX + pnlW - 78, by4 = y + 14, bw = 70, bh = 28;
            ctx.fillStyle = canBuy ? 'rgba(56,142,60,0.85)' : 'rgba(80,80,80,0.6)';
            ctx.beginPath(); ctx.roundRect(bx, by4, bw, bh, 6); ctx.fill();
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 11px Arial, sans-serif';
            ctx.fillText('Buy +1', bx + bw / 2, by4 + 19);

            const _id = pu.id, _name = pu.name;
            this._shopItemBtns.push({ x: bx, y: by4, w: bw, h: bh, action: () => {
                const r = PlayerData.buyPowerup(_id);
                this._shopFeedback = { msg: r.ok ? 'Bought ' + _name + '!' : r.msg, timer: 2, ok: r.ok };
            }});
            y += rowH;
        }
    },

    // ── In-game power-up HUD ─────────────────────────────────────────────────
    drawPowerupHUD(ctx, w, h) {
        const pus = PlayerData.POWERUPS;
        let anyOwned = false;
        for (const pu of pus) { if (PlayerData.getPowerupCount(pu.id) > 0) { anyOwned = true; break; } }
        if (!anyOwned) { this._powerupHUDBtns = []; return; }

        const slotW = 68, slotH = 46, gap = 6;
        const totalW = pus.length * slotW + (pus.length - 1) * gap;
        const sx = w / 2 - totalW / 2;
        const sy = h - slotH - 10;

        // Rebuild click areas every frame
        this._powerupHUDBtns = [];

        for (let i = 0; i < pus.length; i++) {
            const pu    = pus[i];
            const count = PlayerData.getPowerupCount(pu.id);
            const x = sx + i * (slotW + gap), y = sy;
            const isActive = (pu.id === 'neutralize' && this.neutralizeTimer > 0) ||
                             (pu.id === 'jumper'     && this.jumperTimer > 0);
            const canUse = count > 0;

            // Slot background — pulse gently when usable
            const pulse = canUse ? 0.5 + Math.sin(performance.now() * 0.004 + i) * 0.08 : 0;
            ctx.fillStyle = isActive
                ? 'rgba(255,220,50,0.22)'
                : canUse ? `rgba(20,20,40,${0.70 + pulse})` : 'rgba(0,0,0,0.45)';
            ctx.beginPath(); ctx.roundRect(x, y, slotW, slotH, 6); ctx.fill();

            ctx.strokeStyle = isActive ? '#FFD700'
                : canUse ? 'rgba(100,220,255,0.55)' : 'rgba(255,255,255,0.08)';
            ctx.lineWidth = isActive ? 2 : canUse ? 1.5 : 1;
            ctx.stroke();

            // Key hint
            ctx.fillStyle = 'rgba(0,229,255,0.80)';
            ctx.font = 'bold 10px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('[' + pu.key + ']', x + 4, y + 12);

            // Icon
            ctx.font = '16px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(pu.icon, x + slotW / 2, y + 30);

            // Count
            ctx.fillStyle = canUse ? '#69F0AE' : 'rgba(255,255,255,0.25)';
            ctx.font = 'bold 10px Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('x' + count, x + slotW - 4, y + 44);

            // Register click area (only when usable)
            if (canUse) {
                const _id = pu.id;
                this._powerupHUDBtns.push({ x, y, w: slotW, h: slotH, id: _id });
            }
        }
        ctx.textAlign = 'left';
    },

    // ── Bird visual ───────────────────────────────────────────────────────────
    drawBirdEffect(ctx, w, h) {
        const progress = 1 - (this.birdTimer / 2.5);
        const bx = -80 + progress * (w + 200);
        const by = h * 0.30 + Math.sin(progress * Math.PI * 3) * 25;

        ctx.save();
        ctx.globalAlpha = Math.min(1, this.birdTimer * 0.8);

        const flapAngle = Math.sin(performance.now() * 0.025) * 0.55;

        // Wings
        ctx.fillStyle = '#5D4037';
        ctx.save(); ctx.translate(bx - 4, by - 6);
        ctx.rotate(-flapAngle);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-20,-16); ctx.lineTo(-10,0);
        ctx.closePath(); ctx.fill(); ctx.restore();

        ctx.save(); ctx.translate(bx + 4, by - 6);
        ctx.rotate(flapAngle);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(20,-16); ctx.lineTo(10,0);
        ctx.closePath(); ctx.fill(); ctx.restore();

        // Body
        ctx.fillStyle = '#795548';
        ctx.beginPath(); ctx.ellipse(bx, by, 18, 9, -0.15, 0, Math.PI * 2); ctx.fill();

        // Beak
        ctx.fillStyle = '#FFC107';
        ctx.beginPath(); ctx.moveTo(bx + 18, by); ctx.lineTo(bx + 26, by + 2); ctx.lineTo(bx + 18, by + 5); ctx.closePath(); ctx.fill();

        // Eye
        ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(bx + 12, by - 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(bx + 13, by - 2, 1.5, 0, Math.PI * 2); ctx.fill();

        // Label above bird
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 5;
        ctx.fillText('\uD83D\uDCA8 +20 BLOCKS!', bx, by - 20);
        ctx.shadowBlur = 0;

        ctx.restore();
    },
};
