/**
 * chunkFile.js — File Chunking & Poseidon Merkle Tree Builder
 * 
 * Reads a file, splits it into fixed-size chunks (default 64 bytes),
 * computes a Poseidon hash for each chunk, builds a binary Merkle tree,
 * and outputs the Merkle root + tree data.
 * 
 * Usage: node scripts/chunkFile.js <filepath> [chunkSize]
 * Output: Saves to input/merkle_data.json
 * 
 * Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
 */

const fs = require("fs");
const path = require("path");
const circomlibjs = require("circomlibjs");

const CHUNK_SIZE = parseInt(process.argv[3]) || 64;

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("Usage: node scripts/chunkFile.js <filepath> [chunkSize]");
        process.exit(1);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileText = fileBuffer.toString("utf-8");
    console.log(`📄 File: ${filePath} (${fileBuffer.length} bytes)`);
    console.log(`📦 Chunk size: ${CHUNK_SIZE} bytes`);

    // --- Step 1: Split file into chunks ---
    const chunks = [];
    for (let i = 0; i < fileBuffer.length; i += CHUNK_SIZE) {
        const chunk = Buffer.alloc(CHUNK_SIZE, 32); // pad with spaces (ASCII 32)
        fileBuffer.copy(chunk, 0, i, Math.min(i + CHUNK_SIZE, fileBuffer.length));
        chunks.push(Array.from(chunk));
    }
    console.log(`🔢 Total chunks: ${chunks.length}`);

    // --- Step 2: Hash each chunk with Poseidon (cascade: 4 blocks of 16) ---
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;

    function poseidonChunkHash(chunkBytes) {
        // Split 64 bytes into 4 blocks of 16
        const numBlocks = CHUNK_SIZE / 16;
        const blockHashes = [];
        for (let b = 0; b < numBlocks; b++) {
            const block = chunkBytes.slice(b * 16, (b + 1) * 16).map(x => BigInt(x));
            const h = poseidon(block);
            blockHashes.push(F.toObject(h));
        }
        // Combine block hashes
        const finalHash = poseidon(blockHashes);
        return F.toObject(finalHash);
    }

    const chunkHashes = chunks.map((chunk, i) => {
        const hash = poseidonChunkHash(chunk);
        if (i < 3 || i === chunks.length - 1) {
            console.log(`   Chunk ${i}: hash = ${hash.toString().substring(0, 20)}...`);
        } else if (i === 3) {
            console.log(`   ...`);
        }
        return hash;
    });

    // --- Step 3: Build binary Merkle tree ---
    // Pad to next power of 2
    const treeDepth = Math.ceil(Math.log2(chunkHashes.length)) || 1;
    const leafCount = Math.pow(2, treeDepth);
    console.log(`🌳 Merkle tree depth: ${treeDepth}, leaf slots: ${leafCount}`);

    // Pad with zero hashes
    const ZERO_HASH = BigInt(0);
    const leaves = [...chunkHashes];
    while (leaves.length < leafCount) {
        leaves.push(ZERO_HASH);
    }

    // Build tree bottom-up
    // tree[0] = leaves, tree[depth] = [root]
    const tree = [leaves.map(h => h)];
    for (let level = 0; level < treeDepth; level++) {
        const currentLevel = tree[level];
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1];
            const parent = F.toObject(poseidon([left, right]));
            nextLevel.push(parent);
        }
        tree.push(nextLevel);
    }

    const merkleRoot = tree[treeDepth][0];
    console.log(`\n🔑 Merkle Root: ${merkleRoot.toString()}`);

    // --- Step 4: Save output ---
    const outputDir = path.join(__dirname, "..", "input");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const output = {
        filePath: filePath,
        chunkSize: CHUNK_SIZE,
        totalChunks: chunks.length,
        treeDepth: treeDepth,
        merkleRoot: merkleRoot.toString(),
        chunkHashes: chunkHashes.map(h => h.toString()),
        // Store the full tree for Merkle proof generation
        tree: tree.map(level => level.map(h => h.toString())),
        // Store raw chunks for proof generation
        chunks: chunks
    };

    const outPath = path.join(outputDir, "merkle_data.json");
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Saved to: ${outPath}`);
}

main().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
