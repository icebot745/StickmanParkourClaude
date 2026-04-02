// input.js — Keyboard + mobile swipe handling

const Input = {
    keys: {},
    justPressed: {},

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
    },

    isDown(key) {
        return !!this.keys[key];
    },

    wasPressed(key) {
        return !!this.justPressed[key];
    },

    clearFrame() {
        this.justPressed = {};
    },

    get left() { return this.isDown('ArrowLeft') || this.isDown('a'); },
    get right() { return this.isDown('ArrowRight') || this.isDown('d'); },
    get jump() { return this.wasPressed('ArrowUp') || this.wasPressed('w') || this.wasPressed(' '); },
    get down() { return this.isDown('ArrowDown') || this.isDown('s'); },
};
