// sound.js — Web Audio API procedural sound effects

const Sound = (() => {
    let _ctx = null;

    function ac() {
        if (!_ctx) {
            try {
                _ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) { return null; }
        }
        if (_ctx.state === 'suspended') _ctx.resume();
        return _ctx;
    }

    // Frequency sweep: f0 → f1 over `dur` seconds
    function sweep(f0, f1, type, dur, vol, delay = 0) {
        const c = ac(); if (!c) return;
        try {
            const osc = c.createOscillator();
            const g   = c.createGain();
            osc.connect(g); g.connect(c.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(f0, c.currentTime + delay);
            osc.frequency.exponentialRampToValueAtTime(f1, c.currentTime + delay + dur);
            g.gain.setValueAtTime(vol, c.currentTime + delay);
            g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
            osc.start(c.currentTime + delay);
            osc.stop(c.currentTime + delay + dur + 0.01);
        } catch (e) {}
    }

    // Single tone with soft attack
    function tone(freq, type, dur, vol, delay = 0) {
        const c = ac(); if (!c) return;
        try {
            const osc = c.createOscillator();
            const g   = c.createGain();
            osc.connect(g); g.connect(c.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, c.currentTime + delay);
            g.gain.setValueAtTime(0, c.currentTime + delay);
            g.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.012);
            g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
            osc.start(c.currentTime + delay);
            osc.stop(c.currentTime + delay + dur + 0.01);
        } catch (e) {}
    }

    return {
        jump()        { sweep(280, 560, 'square',   0.12, 0.12); },
        land()        { sweep(180,  90, 'sine',     0.09, 0.18); },
        roll()        { sweep(380, 760, 'sawtooth', 0.18, 0.07); },
        slimeBounce() { sweep(180, 480, 'sine',     0.15, 0.22); },
        magma()       { sweep(750, 180, 'sawtooth', 0.28, 0.30); },

        death() {
            sweep(420,  60, 'sawtooth', 0.45, 0.28);
            sweep(300,  80, 'square',   0.35, 0.16);
        },

        checkpoint() {
            tone(523, 'sine', 0.14, 0.28, 0.00);
            tone(659, 'sine', 0.14, 0.28, 0.13);
            tone(784, 'sine', 0.22, 0.28, 0.26);
        },

        boost() {
            sweep(380, 1200, 'square', 0.22, 0.22);
            sweep(500, 1400, 'sine',   0.18, 0.15);
        },

        complete() {
            [523, 659, 784, 1047].forEach((f, i) =>
                tone(f, 'sine', 0.30, 0.32, i * 0.15)
            );
        },

        timerWarning() { tone(880, 'square', 0.10, 0.18); },
    };
})();
