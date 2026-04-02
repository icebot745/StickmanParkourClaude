// level.js — Procedural generation, checkpoints

const Level = {
    TOTAL_BLOCKS: 100,
    CHECKPOINT_INDICES: [15, 30, 45, 60, 75, 90], // every 15 blocks

    generate(canvasHeight) {
        const blocks = [];
        const baseY = canvasHeight * 0.62;

        // --- Starting platform (wide, safe) ---
        const startBlock = new Block(80, baseY, 140, 30);
        startBlock.blockIndex = 0;
        blocks.push(startBlock);

        let x = 80 + 140;
        let lastGap = 0;

        // --- Build the type assignment map ---
        // Some slots MUST be dirt: checkpoints, block before each checkpoint,
        // the finish block, and the first 3 blocks for a safe start.
        const forcedDirt = new Set([1, 2, 3, 99]);
        for (const idx of this.CHECKPOINT_INDICES) {
            forcedDirt.add(idx);
            forcedDirt.add(idx - 1);
        }

        // Collect non-forced slot indices
        const nonForced = [];
        for (let i = 1; i < this.TOTAL_BLOCKS; i++) {
            if (!forcedDirt.has(i)) nonForced.push(i);
        }

        // Build a pool of exactly 15 of each special type, 10 moving, rest dirt
        const typePool = [];
        for (let i = 0; i < 15; i++) typePool.push(BlockType.SLIME);
        for (let i = 0; i < 15; i++) typePool.push(BlockType.DISAPPEARING);
        for (let i = 0; i < 15; i++) typePool.push(BlockType.CONVEYOR);
        for (let i = 0; i < 15; i++) typePool.push(BlockType.MAGMA);
        for (let i = 0; i < 10; i++) typePool.push(BlockType.MOVING);
        for (let i = 0; i < 10; i++) typePool.push(BlockType.BOUNCE);
        while (typePool.length < nonForced.length) typePool.push(BlockType.DIRT);

        // Fisher-Yates shuffle
        for (let i = typePool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [typePool[i], typePool[j]] = [typePool[j], typePool[i]];
        }

        // Map block index → type
        const blockTypes = {};
        for (let i = 0; i < nonForced.length; i++) {
            blockTypes[nonForced[i]] = typePool[i];
        }
        for (const idx of forcedDirt) {
            blockTypes[idx] = BlockType.DIRT;
        }

        // --- Generate blocks 1–99 ---
        for (let i = 1; i < this.TOTAL_BLOCKS; i++) {
            const rawDifficulty = i / this.TOTAL_BLOCKS;
            const difficulty = rawDifficulty * rawDifficulty; // eased curve

            // Platform width: starts 80–120px, shrinks to 40–70px
            const minWidth = 80 - rawDifficulty * 40;
            const maxWidth = 120 - rawDifficulty * 50;
            let width = minWidth + Math.random() * (maxWidth - minWidth);

            // Gap between blocks: starts 40–80px, grows to 80–160px
            const minGap = 40 + difficulty * 40;
            const maxGap = 80 + difficulty * 80;

            let gap;
            if (lastGap > 100) {
                gap = (minGap + maxGap) / 2;
            } else {
                gap = minGap + Math.random() * (maxGap - minGap);
            }
            lastGap = gap;

            // Height variation: starts ±40px, grows to ±90px
            const heightRange = 40 + difficulty * 50;
            const heightOffset = (Math.random() - 0.5) * 2 * heightRange;

            const prevY = blocks[blocks.length - 1].y;
            const rawY = prevY + heightOffset;
            const y = Math.max(150, Math.min(rawY, canvasHeight - 200));

            const isCheckpoint = this.CHECKPOINT_INDICES.includes(i);
            const isBeforeCheckpoint = this.CHECKPOINT_INDICES.includes(i + 1);

            // Widen checkpoint and pre-checkpoint blocks for fairness
            if (isCheckpoint || isBeforeCheckpoint) {
                width = Math.max(width, 80);
            }

            // Final block: wide finish platform
            if (i === this.TOTAL_BLOCKS - 1) {
                width = 140;
            }

            const block = new Block(x + gap, y, width, 30);
            block.blockIndex = i;

            if (isCheckpoint) block.checkpoint = true;
            if (i === this.TOTAL_BLOCKS - 1) block.finish = true;

            // Assign pre-determined type
            block.type = blockTypes[i] || BlockType.DIRT;
            if (block.type === BlockType.CONVEYOR) {
                block.direction = Math.random() < 0.5 ? 1 : -1;
            }
            if (block.type === BlockType.MOVING) {
                block.startX = block.x;
                block.moveRange = 55 + Math.random() * 65; // 55–120px range
                block.moveSpeed = 0.7 + Math.random() * 1.1; // varied speeds
                block.movePhase = Math.random() * Math.PI * 2; // random start phase
                block.dx = 0;
            }

            blocks.push(block);
            x = block.x + block.width;
        }

        return blocks;
    },
};
