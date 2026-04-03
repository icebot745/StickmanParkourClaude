// playerdata.js — Persistent player data: gold, cosmetics, power-up inventory

const PlayerData = (() => {
    const KEY = 'pvr_playerdata';

    const COSMETICS = [
        // ── Stickman colours ─────────────────────────────────────────────────
        { id: 'color_red',    name: 'Red',    type: 'color', color: '#FF5252', price: 700  },
        { id: 'color_blue',   name: 'Blue',   type: 'color', color: '#2979FF', price: 700  },
        { id: 'color_purple', name: 'Purple', type: 'color', color: '#CE93D8', price: 800  },
        { id: 'color_teal',   name: 'Teal',   type: 'color', color: '#00BCD4', price: 900  },
        { id: 'color_gold',   name: 'Gold',   type: 'color', color: '#FFD700', price: 1200 },
        // ── Accessories ───────────────────────────────────────────────────────
        { id: 'hat_party', name: 'Party Hat',  type: 'hat',     price: 700  },
        { id: 'hat_top',   name: 'Top Hat',    type: 'hat',     price: 900  },
        { id: 'hat_crown', name: 'Crown',      type: 'hat',     price: 1300 },
        { id: 'glasses',   name: 'Sunglasses', type: 'glasses', price: 800  },
        { id: 'cape',      name: 'Cape',       type: 'cape',    price: 1500 },
    ];

    const POWERUPS = [
        { id: 'bird',       name: 'Bird Booster',  icon: '\uD83E\uDD85', desc: 'A bird carries you 20 blocks forward!',  price: 1000, key: '1' },
        { id: 'timer',      name: 'Timer Upgrade', icon: '\u23F1',       desc: 'Adds 2 minutes to your timer.',          price: 750,  key: '2' },
        { id: 'neutralize', name: 'Neutralize',    icon: '\uD83C\uDF3F', desc: 'All blocks become dirt for 1 minute.',   price: 500,  key: '3' },
        { id: 'jumper',     name: 'Jumper Pumper', icon: '\uD83E\uDD98', desc: 'Double jump height for 45 seconds.',     price: 750,  key: '4' },
        { id: 'fifty',      name: '50/50',         icon: '\u2702',       desc: 'The map shrinks to just 50 blocks!',     price: 1500, key: '5' },
    ];

    function _defaults() {
        return { gold: 0, owned: [], equip: {}, inv: {} };
    }

    // In-memory cache so we don't hit localStorage every frame
    let _cache = null;

    function _load() {
        if (_cache) return _cache;
        try {
            const raw = JSON.parse(localStorage.getItem(KEY));
            _cache = raw ? Object.assign(_defaults(), raw) : _defaults();
        } catch { _cache = _defaults(); }
        return _cache;
    }

    function _save(d) {
        _cache = d;
        try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
    }

    return {
        COSMETICS,
        POWERUPS,

        // ── Gold ─────────────────────────────────────────────────────────────
        getGold()    { return _load().gold; },
        addGold(n)   { const d = _load(); d.gold += Math.floor(n); _save(d); },
        spendGold(n) { const d = _load(); if (d.gold < n) return false; d.gold -= n; _save(d); return true; },

        // ── Cosmetics ─────────────────────────────────────────────────────────
        isOwned(id)   { return _load().owned.includes(id); },
        getEquipped() { return _load().equip || {}; },

        buyCosmetic(id) {
            const item = COSMETICS.find(c => c.id === id);
            if (!item) return { ok: false, msg: 'Unknown item' };
            const d = _load();
            if (d.owned.includes(id)) return { ok: false, msg: 'Already owned' };
            if (d.gold < item.price) return { ok: false, msg: 'Not enough gold!' };
            d.gold -= item.price;
            d.owned.push(id);
            _save(d);
            return { ok: true };
        },

        // Toggle equip / unequip (one per slot type)
        equipCosmetic(id) {
            const item = COSMETICS.find(c => c.id === id);
            if (!item) return false;
            const d = _load();
            if (!d.owned.includes(id)) return false;
            if (!d.equip) d.equip = {};
            if (d.equip[item.type] === id) delete d.equip[item.type];
            else d.equip[item.type] = id;
            _save(d);
            return true;
        },

        // ── Power-ups ─────────────────────────────────────────────────────────
        getPowerupCount(id) { return _load().inv[id] || 0; },

        buyPowerup(id) {
            const pu = POWERUPS.find(p => p.id === id);
            if (!pu) return { ok: false, msg: 'Unknown power-up' };
            const d = _load();
            if (d.gold < pu.price) return { ok: false, msg: 'Not enough gold!' };
            d.gold -= pu.price;
            d.inv[id] = (d.inv[id] || 0) + 1;
            _save(d);
            return { ok: true };
        },

        usePowerup(id) {
            const d = _load();
            if (!d.inv[id] || d.inv[id] <= 0) return false;
            d.inv[id]--;
            _save(d);
            return true;
        },
    };
})();
