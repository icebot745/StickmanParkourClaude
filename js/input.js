// input.js — Keyboard + mobile touch handling

const Input = {
    keys: {},
    justPressed: {},

    // Touch flags
    touchLeft:      false,
    touchRight:     false,
    touchJumpFrame: false,
    touchDownFrame: false,

    init() {
        window.addEventListener('keydown', (e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
                e.preventDefault();
            }
            if (!this.keys[e.key]) {
                this.justPressed[e.key] = true;
            }
            this.keys[e.key] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        this.initTouch();
    },

    initTouch() {
        let startX = 0, startY = 0, curX = 0, curY = 0;
        const SWIPE = 32;   // px threshold for a directional swipe
        const TAP   = 14;   // px — movement below this = tap

        window.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            startX = curX = t.clientX;
            startY = curY = t.clientY;
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const t  = e.changedTouches[0];
            curX = t.clientX;
            curY = t.clientY;
            const dx = curX - startX;
            const dy = curY - startY;

            // Horizontal hold → continuous movement
            if (Math.abs(dx) > Math.abs(dy)) {
                this.touchRight = dx >  SWIPE;
                this.touchLeft  = dx < -SWIPE;
            }

            // Swipe down → roll (one-shot flag)
            if (dy > SWIPE * 1.5 && Math.abs(dy) > Math.abs(dx)) {
                this.touchDownFrame = true;
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            e.preventDefault();
            const dx = curX - startX;
            const dy = curY - startY;

            // Tap (barely moved) → jump
            if (Math.abs(dx) < TAP && Math.abs(dy) < TAP) {
                this.touchJumpFrame = true;
            }
            // Swipe up → jump
            if (dy < -SWIPE && Math.abs(dy) > Math.abs(dx)) {
                this.touchJumpFrame = true;
            }

            // Release movement
            this.touchLeft  = false;
            this.touchRight = false;
        }, { passive: false });
    },

    isDown(key)    { return !!this.keys[key]; },
    wasPressed(key){ return !!this.justPressed[key]; },

    clearFrame() {
        this.justPressed   = {};
        this.touchJumpFrame = false;
        this.touchDownFrame = false;
    },

    get left()  { return this.isDown('ArrowLeft')  || this.isDown('a') || this.touchLeft;  },
    get right() { return this.isDown('ArrowRight') || this.isDown('d') || this.touchRight; },
    get jump()  { return this.wasPressed('ArrowUp') || this.wasPressed('w') || this.wasPressed(' ') || this.touchJumpFrame; },
    get down()  { return this.isDown('ArrowDown')  || this.isDown('s') || this.touchDownFrame; },
};
