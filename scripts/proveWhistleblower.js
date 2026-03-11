/**
 * proveWhistleblower.js — ZK Proof Generator (Whistleblower Side)
 * 
 * This script simulates the whistleblower:
 *   1. Reads the document file locally
 *   2. Finds the chunk containing the target phrase
 *   3. Builds a Merkle inclusion proof for that chunk
 *   4. Prepares the private witness (chunk + path + optional signature)
 *   5. Generates a Groth16 ZK proof using snarkjs
 * 
 * The proof and public signals are saved for verification.
 * 
 * Usage: node scripts/proveWhistleblower.js [phrase]
 * Requires: input/merkle_data.json, input/signature.json, build/whistleblower_js/whistleblower.wasm, build/circuit_final.zkey
 * Output: input/proof.json, input/public.json
 * 
 * Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
 */

const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

const DEFAULT_PHRASE = "Confidential: Toxic Waste";
const CIRCUIT_DEPTH = 10; // Must match circuit instantiation

async function main() {
    const phrase = process.argv[2] || DEFAULT_PHRASE;
    console.log("🕵️  Whistleblower Proof Generator\n");
    console.log(`   Target phrase: "${phrase}" (${phrase.length} chars)`);

    // --- Load Merkle data ---
    const inputDir = path.join(__dirname, "..", "input");
    const merkleData = JSON.parse(fs.readFileSync(path.join(inputDir, "merkle_data.json")));
    const chunks = merkleData.chunks;
    const tree = merkleData.tree;
    const treeDepth = merkleData.treeDepth;

    console.log(`   Document: ${merkleData.totalChunks} chunks, tree depth ${treeDepth}`);

    // --- Find the chunk containing the phrase ---
    let phraseChunkIndex = -1;
    for (let i = 0; i < chunks.length; i++) {
        const chunkStr = chunks[i].map(b => String.fromCharCode(b)).join("");
        if (chunkStr.includes(phrase)) {
            phraseChunkIndex = i;
            break;
        }
    }

    if (phraseChunkIndex === -1) {
        console.error("❌ Phrase not found in any chunk! Cannot generate proof.");
        console.error("   Tip: The phrase must fit entirely within a single chunk.");
        console.error(`   Chunk size: ${merkleData.chunkSize} bytes, Phrase size: ${phrase.length} bytes`);
        process.exit(1);
    }

    console.log(`   ✅ Phrase found in chunk ${phraseChunkIndex}`);

    // --- Build Merkle inclusion proof ---
    const pathElements = [];
    const pathIndices = [];
    let currentIndex = phraseChunkIndex;

    for (let level = 0; level < treeDepth; level++) {
        const isRight = currentIndex % 2;
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
        
        pathElements.push(tree[level][siblingIndex] || "0");
        pathIndices.push(isRight);
        currentIndex = Math.floor(currentIndex / 2);
    }

    console.log(`   Merkle proof: ${pathElements.length} path elements`);

    // --- Pad path to circuit depth ---
    // If tree depth < circuit depth, pad with zeros
    while (pathElements.length < CIRCUIT_DEPTH) {
        pathElements.push("0");
        pathIndices.push(0);
    }

    // --- Prepare circuit inputs ---
    const phraseAscii = [];
    for (let i = 0; i < phrase.length; i++) {
        phraseAscii.push(phrase.charCodeAt(i));
    }

    // Load signature data (for EdDSA inputs — used as dummy if EdDSA disabled)
    let sigData;
    try {
        sigData = JSON.parse(fs.readFileSync(path.join(inputDir, "signature.json")));
    } catch (e) {
        // Default dummy values when no signature exists
        sigData = { Ax: "0", Ay: "0", R8x: "0", R8y: "0", S: "0" };
    }

    const circuitInput = {
        // Public inputs
        root: merkleData.merkleRoot,
        targetPhrase: phraseAscii,
        // Private inputs
        documentChunk: chunks[phraseChunkIndex],
        pathElements: pathElements.map(String),
        pathIndices: pathIndices.map(String),
        // EdDSA inputs (used only if ENABLE_EDDSA=1 in circuit)
        Ax: sigData.Ax,
        Ay: sigData.Ay,
        R8x: sigData.R8x,
        R8y: sigData.R8y,
        S: sigData.S
    };

    // Save the raw input for debugging
    const inputPath = path.join(inputDir, "input.json");
    fs.writeFileSync(inputPath, JSON.stringify(circuitInput, null, 2));
    console.log(`\n   📝 Circuit input saved to: ${inputPath}`);

    // --- Generate ZK Proof ---
    console.log("\n⏳ Generating Groth16 proof (this may take a moment)...\n");

    const wasmPath = path.join(__dirname, "..", "build", "whistleblower_js", "whistleblower.wasm");
    const zkeyPath = path.join(__dirname, "..", "build", "circuit_final.zkey");

    if (!fs.existsSync(wasmPath)) {
        console.error(`❌ Circuit WASM not found at: ${wasmPath}`);
        console.error("   Run 'npm run build:circuit' first (requires circom in WSL2).");
        process.exit(1);
    }
    if (!fs.existsSync(zkeyPath)) {
        console.error(`❌ Circuit zkey not found at: ${zkeyPath}`);
        console.error("   Run 'npm run build:circuit' first.");
        process.exit(1);
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInput,
        wasmPath,
        zkeyPath
    );

    console.log("✅ Proof generated successfully!\n");
    console.log("   📊 Public Signals:");
    console.log(`      [0] root: ${publicSignals[0].substring(0, 30)}...`);
    for (let i = 1; i <= phraseAscii.length && i < publicSignals.length; i++) {
        if (i <= 3 || i === phraseAscii.length) {
            const char = String.fromCharCode(parseInt(publicSignals[i]));
            console.log(`      [${i}] targetPhrase[${i-1}]: ${publicSignals[i]} ('${char}')`);
        } else if (i === 4) {
            console.log(`      ...`);
        }
    }
    // The last public signal is chunkHashOut
    const chunkHashIdx = publicSignals.length - 1;
    console.log(`      [${chunkHashIdx}] chunkHash: ${publicSignals[chunkHashIdx].substring(0, 30)}...`);

    // Save proof and public signals
    const proofPath = path.join(inputDir, "proof.json");
    const publicPath = path.join(inputDir, "public.json");

    fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
    fs.writeFileSync(publicPath, JSON.stringify(publicSignals, null, 2));

    console.log(`\n💾 Proof saved to: ${proofPath}`);
    console.log(`💾 Public signals saved to: ${publicPath}`);
    console.log(`\n🔒 Nothing about the document content was revealed!`);
    console.log(`   Only the Merkle root, target phrase, and chunk hash are public.`);
}

main().catch(err => {
    console.error("❌ Error during proof generation:", err.message);
    if (err.message.includes("Assert Failed")) {
        console.error("\n🔍 Debugging tips:");
        console.error("   1. Check that the phrase exists in exactly one chunk");
        console.error("   2. Verify the Merkle root matches between input.json and the tree");
        console.error("   3. Check pathElements and pathIndices match the tree structure");
        console.error("   4. Run: snarkjs wtns debug build/whistleblower.r1cs input/input.json build/whistleblower.sym");
    }
    process.exit(1);
});
