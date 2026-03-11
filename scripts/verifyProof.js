/**
 * verifyProof.js — ZK Proof Verifier
 * 
 * Verifies a Groth16 proof locally using snarkjs and displays
 * all public signals in human-readable format.
 * 
 * Usage: node scripts/verifyProof.js
 * Requires: build/verification_key.json, input/proof.json, input/public.json
 * 
 * Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
 */

const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

async function main() {
    console.log("🔍 ZK Proof Verifier\n");

    const buildDir = path.join(__dirname, "..", "build");
    const inputDir = path.join(__dirname, "..", "input");

    // Load verification key
    const vKeyPath = path.join(buildDir, "verification_key.json");
    if (!fs.existsSync(vKeyPath)) {
        console.error("❌ Verification key not found. Run build:circuit first.");
        process.exit(1);
    }
    const vKey = JSON.parse(fs.readFileSync(vKeyPath));

    // Load proof and public signals
    const proof = JSON.parse(fs.readFileSync(path.join(inputDir, "proof.json")));
    const publicSignals = JSON.parse(fs.readFileSync(path.join(inputDir, "public.json")));

    console.log("   📊 Public Signals Analysis:");
    console.log("   ─────────────────────────────");

    // Parse public signals
    // Signal order: root, targetPhrase[0..24], chunkHashOut
    const root = publicSignals[0];
    const phraseLength = 25; // "Confidential: Toxic Waste"
    
    let phraseStr = "";
    for (let i = 1; i <= phraseLength; i++) {
        phraseStr += String.fromCharCode(parseInt(publicSignals[i]));
    }

    const chunkHash = publicSignals[publicSignals.length - 1];

    console.log(`   Merkle Root:   ${root}`);
    console.log(`   Target Phrase: "${phraseStr}"`);
    console.log(`   Chunk Hash:    ${chunkHash}`);
    console.log("   ─────────────────────────────\n");

    // Verify the proof
    console.log("⏳ Verifying Groth16 proof...\n");
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    if (verified) {
        console.log("   ╔═══════════════════════════════════════╗");
        console.log("   ║   ✅ PROOF VERIFICATION: PASSED       ║");
        console.log("   ╚═══════════════════════════════════════╝\n");
        console.log("   The proof cryptographically guarantees:");
        console.log("   1. The prover knows a document chunk containing the phrase");
        console.log("   2. The chunk is correctly hashed via Poseidon");
        console.log("   3. The chunk hash is a leaf in the Merkle tree with the given root");
        console.log("   4. The prover did NOT reveal the document content");
    } else {
        console.log("   ╔═══════════════════════════════════════╗");
        console.log("   ║   ❌ PROOF VERIFICATION: FAILED       ║");
        console.log("   ╚═══════════════════════════════════════╝\n");
        console.log("   The proof is invalid. Possible causes:");
        console.log("   - Proof was tampered with");
        console.log("   - Public signals don't match the proof");
        console.log("   - Wrong verification key");
    }

    return verified;
}

main().then(result => {
    process.exit(result ? 0 : 1);
}).catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
