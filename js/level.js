// level.js — Procedural generation, checkpoints

const Level = {
    TOTAL_BLOCKS: 200,
    CHECKPOINT_INDICES: [49, 99, 149, 189], // ~25%, 50%, 75%, ~95%

    generate(canvasHeight) {
        const blocks = [];
        const baseY = canvasHeight * 0.62;

        // --- Starting platform (wide, safe) ---
        const startBlock = new Block(80, baseY, 140, 30);
        startBlock.blockIndex = 0;
        blocks.push(startBlock);

        let x = 80 + 140; // right edge of start block

        for (let i = 1; i < this.TOTAL_BLOCKS; i++) {
            // Difficulty ramp: 0.0 (easy) → 1.0 (hard) over course of level
            const difficulty = i / this.TOTAL_BLOCKS;

            // Platform width: starts 80–120px, shrinks to 40–70px
            const minWidth = 80 - difficulty * 40;  // 80 → 40
            const maxWidth = 120 - difficulty * 50; // 120 → 70
            const width = minWidth + Math.random() * (maxWidth - minWidth);

            // Gap between blocks: starts 40–80px, grows to 80–160px
            const minGap = 40 + difficulty * 40;   // 40 → 80
            const maxGap = 80 + difficulty * 80;   // 80 → 160
            const gap = minGap + Math.random() * (maxGap - minGap);

            // Height variation: starts ±40px, grows to ±90px
            const heightRange = 40 + difficulty * 50;
            const heightOffset = (Math.random() - 0.5) * 2 * heightRange;

            // Clamp Y so blocks stay well above the void (y > 800 = death)
            const prevY = blocks[blocks.length - 1].y;
            const rawY = prevY + heightOffset;
            const y = Math.max(150, Math.min(rawY, canvasHeight - 200));

            const block = new Block(x + gap, y, width, 30);
            block.blockIndex = i;

            // Mark checkpoints
            if (this.CHECKPOINT_INDICES.includes(i)) {
                block.checkpoint = true;
            }

            blocks.push(block);
            x = block.x + block.width;
        }

        return blocks;
    },
};