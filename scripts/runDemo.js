/**
 * runDemo.js — Full End-to-End Demo Pipeline
 * 
 * Chains all scripts together to demonstrate the complete flow:
 *   1. Chunk the sample document
 *   2. Generate Company-X keypair (if not exists)
 *   3. Sign the Merkle root
 *   4. Generate the whistleblower's ZK proof
 *   5. Verify the proof
 * 
 * Usage: node scripts/runDemo.js
 * 
 * Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCRIPTS_DIR = __dirname;
const ROOT_DIR = path.join(SCRIPTS_DIR, "..");

function run(description, command) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  ${description}`);
    console.log(`${"=".repeat(60)}\n`);
    
    try {
        execSync(command, { 
            stdio: "inherit", 
            cwd: ROOT_DIR 
        });
    } catch (err) {
        console.error(`\n❌ Failed at step: ${description}`);
        process.exit(1);
    }
}

function main() {
    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║   Privacy-Preserving Whistleblower System — Full Demo    ║");
    console.log("║   Using ZK-SNARKs (Groth16 + Poseidon + EdDSA)          ║");
    console.log("╚═══════════════════════════════════════════════════════════╝");

    // Check prerequisites
    const wasmPath = path.join(ROOT_DIR, "build", "whistleblower_js", "whistleblower.wasm");
    const zkeyPath = path.join(ROOT_DIR, "build", "circuit_final.zkey");
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        console.error("\n❌ Circuit build artifacts not found!");
        console.error("   Please run 'npm run build:circuit' first (requires circom in WSL2).");
        console.error(`   Missing: ${!fs.existsSync(wasmPath) ? wasmPath : ""} ${!fs.existsSync(zkeyPath) ? zkeyPath : ""}`);
        process.exit(1);
    }

    // Step 1: Chunk the document
    run(
        "STEP 1/5: Chunking sample document & building Merkle tree",
        "node scripts/chunkFile.js sample_doc.txt"
    );

    // Step 2: Generate keypair (only if not already generated)
    const keyPath = path.join(ROOT_DIR, "keys", "company_x.private.json");
    if (!fs.existsSync(keyPath)) {
        run(
            "STEP 2/5: Generating Company-X EdDSA keypair",
            "node scripts/generateKeypair.js"
        );
    } else {
        console.log(`\n${"=".repeat(60)}`);
        console.log("  STEP 2/5: Company-X keypair already exists, skipping.");
        console.log(`${"=".repeat(60)}`);
    }

    // Step 3: Sign the Merkle root
    run(
        "STEP 3/5: Company-X signs the document's Merkle root (EdDSA)",
        "node scripts/signRoot.js"
    );

    // Step 4: Generate the ZK proof
    run(
        "STEP 4/5: Whistleblower generates ZK proof",
        "node scripts/proveWhistleblower.js"
    );

    // Step 5: Verify the proof
    run(
        "STEP 5/5: Public verification of the proof",
        "node scripts/verifyProof.js"
    );

    console.log(`\n${"=".repeat(60)}`);
    console.log("  ✅ DEMO COMPLETE — All steps passed!");
    console.log(`${"=".repeat(60)}\n`);
    console.log("  Summary:");
    console.log("  • The whistleblower proved the document contains the phrase");
    console.log("  • The document content was NEVER revealed to the verifier");
    console.log("  • The whistleblower's identity was NOT disclosed");
    console.log("  • The proof is cryptographically unforgeable\n");
}

main();
