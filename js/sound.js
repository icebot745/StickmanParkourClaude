// sound.js — Web Audio API sound effects + procedural soundtrack

// ── Shared AudioContext ───────────────────────────────────────────────────────
let _audioCtx  = null;
let _sfxEnabled = true;   // toggled by Settings
function _ac() {
    if (!_audioCtx) {
        try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { return null; }
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
}

// ── Sound Effects ─────────────────────────────────────────────────────────────
const Sound = (() => {

    function sweep(f0, f1, type, dur, vol, delay = 0) {
        if (!_sfxEnabled) return;
        const c = _ac(); if (!c) return;
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

    function tone(freq, type, dur, vol, delay = 0) {
        if (!_sfxEnabled) return;
        const c = _ac(); if (!c) return;
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
        jump()             { sweep(280, 560, 'square',   0.12, 0.12); },
        land()             { sweep(180,  90, 'sine',     0.09, 0.18); },
        roll()             { sweep(380, 760, 'sawtooth', 0.18, 0.07); },
        slimeBounce()      { sweep(180, 480, 'sine',     0.15, 0.22); },
        magma()            { sweep(750, 180, 'sawtooth', 0.28, 0.30); },

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

        timerWarning()     { tone(880, 'square', 0.10, 0.18); },

        disappearWarn() {
            sweep(500, 120, 'square', 0.10, 0.10);
            sweep(400, 100, 'square', 0.10, 0.08, 0.05);
        },

        disappearReappear() {
            sweep(150, 420, 'sine', 0.18, 0.13);
            tone(600,  'sine', 0.10, 0.08, 0.16);
        },

        conveyor() {
            tone(140, 'square', 0.45, 0.11);
            tone(110, 'square', 0.40, 0.08, 0.08);
            tone(130, 'square', 0.35, 0.07, 0.18);
        },

        movingLand() {
            sweep(200, 100, 'sine', 0.10, 0.16);
        },

        setSfxEnabled(v) { _sfxEnabled = v; },
        isSfxEnabled()   { return _sfxEnabled; },
    };
})();

// ── Background Music ──────────────────────────────────────────────────────────
const Music = (() => {
    let _running      = false;
    let _masterGain   = null;
    let _intervalId   = null;
    let _nextBeat     = 0;
    let _step         = 0;
    let _musicEnabled = true;

    const BPM       = 100;              // relaxed tempo
    const S16       = 60 / BPM / 4;    // one 16th-note step in seconds
    const LOOKAHEAD = 0.20;
    const TICK_MS   = 50;

    // ── C major pentatonic: C D E G A ────────────────────────────────────────
    const N = {
        C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00, A3: 220.00,
        C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
        C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
    };

    // ── 32-step patterns (2 bars) ─────────────────────────────────────────────

    // Soft bass — half-note roots, sine wave
    const BASS = [
        N.C3,  null, null, null, null, null, null, null,
        N.G3,  null, null, null, null, null, null, null,
        N.A3,  null, null, null, null, null, null, null,
        N.E3,  null, null, null, null, null, null, null,
    ];

    // Gentle melody — 8th notes, sine wave, flowing up and down
    const MELODY = [
        N.C5,  null, N.A4,  null, N.G4,  null, N.E4,  null,
        N.D4,  null, N.E4,  null, N.G4,  null, N.A4,  null,
        N.C5,  null, N.G4,  null, N.E4,  null, N.D4,  null,
        N.E4,  null, N.G4,  null, N.A4,  null, N.C5,  null,
    ];

    // Soft pad — root + fifth chord tones on beat 1 of each bar
    const PAD = [
        [N.C3, N.G3, N.E4], null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null,
        [N.A3, N.E4, N.A4], null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null,
    ];

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Soft sine note with slow attack and gentle release
    function sineNote(freq, start, dur, vol, dest) {
        const c = _ac(); if (!c) return;
        try {
            const osc = c.createOscillator();
            const g   = c.createGain();
            osc.connect(g); g.connect(dest);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(vol, start + 0.04);   // soft attack
            g.gain.setValueAtTime(vol, start + dur * 0.7);
            g.gain.linearRampToValueAtTime(0, start + dur);       // smooth release
            osc.start(start);
            osc.stop(start + dur + 0.02);
        } catch (e) {}
    }

    // ── Scheduler ─────────────────────────────────────────────────────────────

    function tick() {
        const c = _ac();
        if (!c || !_running || !_masterGain) return;
        while (_nextBeat < c.currentTime + LOOKAHEAD) {
            const s = _step % 32;

            // Bass — long, soft
            if (BASS[s])
                sineNote(BASS[s], _nextBeat, S16 * 7.5, 0.18, _masterGain);

            // Melody — short, delicate
            if (MELODY[s])
                sineNote(MELODY[s], _nextBeat, S16 * 1.6, 0.09, _masterGain);

            // Pad — sustained chords, very quiet
            if (PAD[s])
                PAD[s].forEach(f =>
                    sineNote(f, _nextBeat, S16 * 15, 0.04, _masterGain)
                );

            _nextBeat += S16;
            _step++;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    return {
        start() {
            if (_running || !_musicEnabled) return;
            const c = _ac(); if (!c) return;
            _masterGain = c.createGain();
            _masterGain.gain.setValueAtTime(0.001, c.currentTime);
            _masterGain.gain.linearRampToValueAtTime(0.75, c.currentTime + 2.5);
            _masterGain.connect(c.destination);
            _running  = true;
            _step     = 0;
            _nextBeat = c.currentTime + 0.1;
            _intervalId = setInterval(tick, TICK_MS);
        },

        stop() {
            if (!_running) return;
            _running = false;
            clearInterval(_intervalId);
            if (_masterGain) {
                const c = _ac();
                if (c) {
                    _masterGain.gain.setValueAtTime(_masterGain.gain.value, c.currentTime);
                    _masterGain.gain.linearRampToValueAtTime(0, c.currentTime + 1.2);
                }
                const mg = _masterGain;
                _masterGain = null;
                setTimeout(() => { try { mg.disconnect(); } catch (e) {} }, 1400);
            }
        },

        isRunning()  { return _running; },

        setEnabled(v) {
            _musicEnabled = v;
            if (!v && _running) this.stop();
        },
        isEnabled()  { return _musicEnabled; },
    };
})();
