const fs = require("fs");
const path = require("path");
const circomlibjs = require("circomlibjs");
const snarkjs = require("snarkjs");

async function debugProof() {
    console.log("🕵️  Debugging Exact Snark JS Failure...");

    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;

    function poseidonChunkHash(chunkBytes) {
        const numBlocks = 64 / 16;
        const blockHashes = [];
        for (let b = 0; b < numBlocks; b++) {
            const block = chunkBytes.slice(b * 16, (b + 1) * 16).map(x => BigInt(x));
            blockHashes.push(F.toObject(poseidon(block)));
        }
        return F.toObject(poseidon(blockHashes));
    }

    // 1. Read the pass document
    const fileBytesRaw = Array.from(fs.readFileSync("test_documents/pass_acmechem_memo.txt"));
    const fileBytes = fileBytesRaw.filter(x => x !== 13); // strip \r

    // 2. Chunk it
    const chunks = [];
    for (let i = 0; i < fileBytes.length; i += 64) {
        const chunk = new Array(64).fill(32);
        for (let j = 0; j < 64 && (i + j) < fileBytes.length; j++) {
            chunk[j] = fileBytes[i + j];
        }
        chunks.push(chunk);
    }

    // 3. Build Depth-5 Merkle Tree
    const chunkHashes = chunks.map(c => poseidonChunkHash(c));
    const treeDepth = 5;
    const leaves = [...chunkHashes];
    while (leaves.length < 32) leaves.push(BigInt(0));

    const tree = [leaves.map(h => h.toString())];
    let currentLevel = leaves;
    for (let level = 0; level < treeDepth; level++) {
        const next = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            next.push(F.toObject(poseidon([currentLevel[i], currentLevel[i + 1]])));
        }
        tree.push(next.map(h => h.toString()));
        currentLevel = next;
    }

    // 4. Find Phrase
    const targetPhrase = "Confidential: Toxic Waste";
    let phraseChunkIndex = -1;
    for(let i = 0; i < chunks.length; i++){
        if(chunks[i].map(x=>String.fromCharCode(x)).join('').includes(targetPhrase)) {
            phraseChunkIndex = i;
            break;
        }
    }
    console.log("Chunk index:", phraseChunkIndex);

    // 5. Build Path
    const pathElements = [];
    const pathIndices = [];
    let currentIndex = phraseChunkIndex;
    for (let level = 0; level < 5; level++) {
        const isRight = currentIndex % 2;
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
        pathElements.push(tree[level][siblingIndex].toString());
        pathIndices.push(isRight);
        currentIndex = Math.floor(currentIndex / 2);
    }

    // 6. Test SNARK
    const targetAscii = targetPhrase.split('').map(c => c.charCodeAt(0));
    while(targetAscii.length < 25) targetAscii.push(32);

    const circuitInput = {
        root: tree[5][0],
        targetPhrase: targetAscii,
        documentChunk: chunks[phraseChunkIndex],
        pathElements: pathElements,
        pathIndices: pathIndices,
        Ax: "0", Ay: "0", R8x: "0", R8y: "0", S: "0"
    };

    console.log("Generating fullProve...");
    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            circuitInput,
            path.join(__dirname, "..", "build", "whistleblower_js", "whistleblower.wasm"),
            path.join(__dirname, "..", "build", "circuit_final.zkey")
        );
        console.log("SUCCESS!", publicSignals);
    } catch(e) {
        console.error("FAIL!", e);
        
        // Debug exactly which assert fails
        let currentHash = poseidonChunkHash(chunks[phraseChunkIndex]);
        console.log("Leaf Hash:", currentHash);
        for(let i=0; i < 5; i++) {
            const sibling = BigInt(pathElements[i]);
            const isRight = pathIndices[i];
            if(isRight === 0) currentHash = F.toObject(poseidon([currentHash, sibling]));
            else currentHash = F.toObject(poseidon([sibling, currentHash]));
            console.log(`Level ${i} computed hash:`, currentHash);
            console.log(`Level ${i} expected hash:`, tree[i+1][Math.floor(phraseChunkIndex / Math.pow(2, i+1))]);
        }
        console.log("Final root:", currentHash);
        console.log("Expected root:", tree[5][0]);
    }
}
debugProof();
