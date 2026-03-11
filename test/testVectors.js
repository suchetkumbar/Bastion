/**
 * testVectors.js — Unit Tests & Test Vectors
 * 
 * Validates the cryptographic primitives used in the project:
 *   1. Poseidon chunked hashing consistency
 *   2. Merkle tree construction
 *   3. EdDSA signature generation & verification
 *   4. Substring search logic
 * 
 * Usage: node test/testVectors.js
 * 
 * Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
 */

const circomlibjs = require("circomlibjs");
const crypto = require("crypto");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ ${testName}`);
        failed++;
    }
}

async function main() {
    console.log("╔═══════════════════════════════════════════════════╗");
    console.log("║   Whistleblower-ZK — Test Vectors & Unit Tests   ║");
    console.log("╚═══════════════════════════════════════════════════╝\n");

    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;
    const eddsa = await circomlibjs.buildEddsa();
    const babyJub = await circomlibjs.buildBabyjub();

    // ═════════════════════════════════════════════════════════════
    // TEST SUITE 1: Poseidon Hashing
    // ═════════════════════════════════════════════════════════════
    console.log("─── Test Suite 1: Poseidon Hashing ───\n");

    // Test 1.1: Poseidon is deterministic
    const h1 = F.toObject(poseidon([1n, 2n, 3n]));
    const h2 = F.toObject(poseidon([1n, 2n, 3n]));
    assert(h1 === h2, "Poseidon(1,2,3) is deterministic");

    // Test 1.2: Different inputs produce different hashes
    const h3 = F.toObject(poseidon([1n, 2n, 4n]));
    assert(h1 !== h3, "Poseidon(1,2,3) ≠ Poseidon(1,2,4)");

    // Test 1.3: Cascade hash of 64 bytes
    const testChunk = new Array(64).fill(0).map((_, i) => BigInt(i));
    const blocks = [];
    for (let b = 0; b < 4; b++) {
        const block = testChunk.slice(b * 16, (b + 1) * 16);
        blocks.push(F.toObject(poseidon(block)));
    }
    const cascadeHash = F.toObject(poseidon(blocks));
    assert(cascadeHash > 0n, "Cascade hash of 64-byte chunk is non-zero");

    // Test 1.4: Re-compute produces same result
    const blocks2 = [];
    for (let b = 0; b < 4; b++) {
        const block = testChunk.slice(b * 16, (b + 1) * 16);
        blocks2.push(F.toObject(poseidon(block)));
    }
    const cascadeHash2 = F.toObject(poseidon(blocks2));
    assert(cascadeHash === cascadeHash2, "Cascade hash is reproducible");

    // ═════════════════════════════════════════════════════════════
    // TEST SUITE 2: Merkle Tree
    // ═════════════════════════════════════════════════════════════
    console.log("\n─── Test Suite 2: Merkle Tree ───\n");

    // Build a small 4-leaf tree
    const leaves = [10n, 20n, 30n, 40n].map(v => F.toObject(poseidon([v])));
    
    // Level 0 (leaves): [h(10), h(20), h(30), h(40)]
    // Level 1: [H(h10, h20), H(h30, h40)]
    // Level 2: [H(level1[0], level1[1])] = root
    const level1_0 = F.toObject(poseidon([leaves[0], leaves[1]]));
    const level1_1 = F.toObject(poseidon([leaves[2], leaves[3]]));
    const root = F.toObject(poseidon([level1_0, level1_1]));

    assert(root > 0n, "Merkle root is non-zero");

    // Test Merkle proof for leaf 0:
    // pathElements = [leaves[1], level1_1], pathIndices = [0, 0]
    let computed = leaves[0];
    computed = F.toObject(poseidon([computed, leaves[1]])); // index 0 = left
    assert(computed === level1_0, "Merkle proof level 0 correct");
    computed = F.toObject(poseidon([computed, level1_1])); // index 0 = left
    assert(computed === root, "Merkle proof reaches root");

    // Test Merkle proof for leaf 2 (index=2):
    // pathElements = [leaves[3], level1_0], pathIndices = [0, 1]
    let computed2 = leaves[2];
    computed2 = F.toObject(poseidon([computed2, leaves[3]])); // index 0 = left
    assert(computed2 === level1_1, "Merkle proof leaf 2 level 0");
    computed2 = F.toObject(poseidon([level1_0, computed2])); // index 1 = right, swap!
    assert(computed2 === root, "Merkle proof leaf 2 reaches root");

    // ═════════════════════════════════════════════════════════════
    // TEST SUITE 3: EdDSA Signatures
    // ═════════════════════════════════════════════════════════════
    console.log("\n─── Test Suite 3: EdDSA Signatures ───\n");

    // Generate keypair
    const privateKey = crypto.randomBytes(32);
    const pubKey = eddsa.prv2pub(privateKey);
    
    assert(pubKey[0] !== undefined && pubKey[1] !== undefined, "EdDSA keypair generated");

    // Sign a message (the Merkle root)
    const message = F.e(root);
    const signature = eddsa.signPoseidon(privateKey, message);
    
    assert(signature.R8 !== undefined && signature.S !== undefined, "EdDSA signature generated");

    // Verify the signature
    const isValid = eddsa.verifyPoseidon(message, signature, pubKey);
    assert(isValid === true, "EdDSA signature verification PASSES");

    // Tamper with the message and verify (should fail)
    const tamperedMessage = F.e(root + 1n);
    const isInvalid = eddsa.verifyPoseidon(tamperedMessage, signature, pubKey);
    assert(isInvalid === false, "Tampered message verification FAILS");

    // Wrong key verification (should fail)
    const wrongKey = eddsa.prv2pub(crypto.randomBytes(32));
    const wrongKeyResult = eddsa.verifyPoseidon(message, signature, wrongKey);
    assert(wrongKeyResult === false, "Wrong key verification FAILS");

    // ═════════════════════════════════════════════════════════════
    // TEST SUITE 4: Substring Search
    // ═════════════════════════════════════════════════════════════
    console.log("\n─── Test Suite 4: Substring Search ───\n");

    const phrase = "Confidential: Toxic Waste";
    const M = phrase.length;

    // Test document that DOES contain the phrase
    const testDoc = "This is a test. Confidential: Toxic Waste is here.";
    assert(testDoc.includes(phrase), "Test doc contains phrase");

    // Test that phrase fits in a 64-byte chunk
    assert(M <= 64, `Phrase length (${M}) fits in chunk size (64)`);

    // Find phrase and extract chunk
    const idx = testDoc.indexOf(phrase);
    const startIdx = Math.max(0, idx - 10);
    const chunk = testDoc.substring(startIdx, startIdx + 64).padEnd(64, " ");
    assert(chunk.includes(phrase), "Extracted chunk contains phrase");
    assert(chunk.length === 64, "Chunk is exactly 64 bytes");

    // Sliding window check (simulate circuit logic)
    const chunkBytes = Array.from(chunk).map(c => c.charCodeAt(0));
    const phraseBytes = Array.from(phrase).map(c => c.charCodeAt(0));
    const numWindows = 64 - M + 1;
    let foundWindow = -1;

    for (let w = 0; w < numWindows; w++) {
        let windowMatch = true;
        for (let c = 0; c < M; c++) {
            if (chunkBytes[w + c] !== phraseBytes[c]) {
                windowMatch = false;
                break;
            }
        }
        if (windowMatch) {
            foundWindow = w;
            break;
        }
    }

    assert(foundWindow >= 0, `Sliding window found phrase at offset ${foundWindow}`);

    // ═════════════════════════════════════════════════════════════
    // RESULTS
    // ═════════════════════════════════════════════════════════════
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log(`${"═".repeat(50)}\n`);

    if (failed > 0) {
        console.log("  ❌ SOME TESTS FAILED\n");
        process.exit(1);
    } else {
        console.log("  ✅ ALL TESTS PASSED\n");
        process.exit(0);
    }
}

main().catch(err => {
    console.error("❌ Test runner error:", err.message);
    process.exit(1);
});
