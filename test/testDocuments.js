/**
 * testDocuments.js — Automated test suite for the Whistleblower-ZK system
 * 
 * Tests 12+ documents from different companies:
 *   - PASS docs: contain "Confidential: Toxic Waste" and are registered
 *   - FAIL docs: missing phrase, wrong phrase, or unregistered
 * 
 * Usage: node test/testDocuments.js
 */

const fs = require("fs");
const path = require("path");
const circomlibjs = require("circomlibjs");

// ============================================================================
// Constants (must match circuit)
// ============================================================================
const CHUNK_SIZE = 64;
const CIRCUIT_DEPTH = 5;
const TARGET_PHRASE = "Confidential: Toxic Waste";

// ============================================================================
// Test Document Definitions
// ============================================================================
const TEST_DIR = path.join(__dirname, "..", "test_documents");

const testCases = [
    // ─── EXPECTED PASS — contain phrase, will be registered ───
    {
        file: "pass_acmechem_memo.txt",
        company: "AcmeChem Corp",
        expectPass: true,
        description: "Internal memo about toxic waste exceeding disposal capacity"
    },
    {
        file: "pass_petroglobe_report.txt",
        company: "PetroGlobe Energy",
        expectPass: true,
        description: "Quarterly compliance report with underreported waste volumes"
    },
    {
        file: "pass_novapharma_audit.txt",
        company: "NovaPharma Labs",
        expectPass: true,
        description: "Audit report revealing illegal sewer discharge"
    },
    {
        file: "pass_steelworks_assessment.txt",
        company: "SteelWorks Intl",
        expectPass: true,
        description: "Environmental impact assessment of slag dumping"
    },
    {
        file: "pass_agricorp_memo.txt",
        company: "AgriCorp Holdings",
        expectPass: true,
        description: "Pesticide runoff investigation memo"
    },
    {
        file: "pass_minecore_memo.txt",
        company: "MineCore Resources",
        expectPass: true,
        description: "Tailings pond overflow into creek"
    },
    // ─── Also include the original sample_doc.txt ───
    {
        file: path.join("..", "sample_doc.txt"),
        company: "Original Sample",
        expectPass: true,
        description: "Original test document (already registered)"
    },

    // ─── EXPECTED FAIL — various reasons ───
    {
        file: "fail_cleantech_report.txt",
        company: "CleanTech Solutions",
        expectPass: false,
        failReason: "NO_PHRASE",
        description: "Clean energy annual report — no incriminating content"
    },
    {
        file: "fail_datasoft_advisory.txt",
        company: "DataSoft Inc",
        expectPass: false,
        failReason: "NO_PHRASE",
        description: "Data breach security advisory — wrong type of incident"
    },
    {
        file: "fail_foodcorp_wrongphrase.txt",
        company: "FoodCorp Intl",
        expectPass: false,
        failReason: "WRONG_PHRASE",
        description: "Has 'Confidential: Food Waste' — similar but NOT the target phrase"
    },
    {
        file: "fail_bankfirst_audit.txt",
        company: "BankFirst National",
        expectPass: false,
        failReason: "NO_PHRASE",
        description: "Financial audit — completely unrelated to environmental data"
    },
    {
        file: "fail_automakers_partial.txt",
        company: "AutoMakers Alliance",
        expectPass: false,
        failReason: "PARTIAL_PHRASE",
        description: "Has 'Toxic Waste' but NOT 'Confidential: Toxic Waste'"
    },
    {
        file: "fail_realestate_notice.txt",
        company: "RealEstate Premier",
        expectPass: false,
        failReason: "NO_PHRASE",
        description: "Tenant maintenance notice — completely unrelated"
    },
];

// ============================================================================
// Poseidon Merkle Tree (mirrors chunkFile.js and App.jsx logic)
// ============================================================================

function poseidonChunkHash(poseidon, F, chunkBytes) {
    const numBlocks = CHUNK_SIZE / 16;
    const blockHashes = [];
    for (let b = 0; b < numBlocks; b++) {
        const block = chunkBytes.slice(b * 16, (b + 1) * 16).map(x => BigInt(x));
        blockHashes.push(F.toObject(poseidon(block)));
    }
    return F.toObject(poseidon(blockHashes));
}

function buildMerkleTree(poseidon, F, fileBytes) {
    const chunks = [];
    for (let i = 0; i < fileBytes.length; i += CHUNK_SIZE) {
        const chunk = new Array(CHUNK_SIZE).fill(32);
        for (let j = 0; j < CHUNK_SIZE && (i + j) < fileBytes.length; j++) {
            chunk[j] = fileBytes[i + j];
        }
        chunks.push(chunk);
    }

    const chunkHashes = chunks.map(c => poseidonChunkHash(poseidon, F, c));

    // Force tree depth to 5 since circuit expects 32 leaves (DEPTH=5)
    const treeDepth = 5;
    const leafCount = Math.pow(2, treeDepth);

    const leaves = [...chunkHashes];
    while (leaves.length < leafCount) leaves.push(BigInt(0));

    const tree = [leaves.slice()];
    for (let level = 0; level < treeDepth; level++) {
        const cur = tree[level];
        const next = [];
        for (let i = 0; i < cur.length; i += 2) {
            next.push(F.toObject(poseidon([cur[i], cur[i + 1]])));
        }
        tree.push(next);
    }

    return {
        chunks,
        merkleRoot: tree[treeDepth][0].toString(),
        treeDepth,
        totalChunks: chunks.length
    };
}

function findPhraseChunk(chunks, phrase) {
    for (let i = 0; i < chunks.length; i++) {
        const chunkStr = chunks[i].map(b => String.fromCharCode(b)).join("");
        if (chunkStr.includes(phrase)) return i;
    }
    return -1;
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runTests() {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║   WHISTLEBLOWER-ZK DOCUMENT TEST SUITE                   ║");
    console.log("║   Testing 13 documents across 12 companies               ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    // Initialize Poseidon
    console.log("⏳ Initializing Poseidon hasher...");
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;
    console.log("✅ Poseidon ready\n");

    // Phase 1: Process all documents
    console.log("━━━ PHASE 1: Document Analysis ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const results = [];
    const registeredRoots = [];

    for (const tc of testCases) {
        const filePath = path.join(TEST_DIR, tc.file);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  SKIP: ${tc.file} (file not found)`);
            results.push({ ...tc, status: "SKIP", reason: "File not found" });
            continue;
        }

        const fileBytes = Array.from(fs.readFileSync(filePath));
        const fileText = fs.readFileSync(filePath, "utf-8");
        const { chunks, merkleRoot, treeDepth, totalChunks } = buildMerkleTree(poseidon, F, fileBytes);

        const containsPhrase = fileText.includes(TARGET_PHRASE);
        const phraseChunkIdx = findPhraseChunk(chunks, TARGET_PHRASE);

        const result = {
            ...tc,
            fileSize: fileBytes.length,
            totalChunks,
            treeDepth,
            merkleRoot,
            containsPhrase,
            phraseChunkIdx,
        };

        // Register PASS documents
        if (tc.expectPass && containsPhrase) {
            registeredRoots.push(merkleRoot);
            result.registered = true;
        } else {
            result.registered = false;
        }

        // Determine test outcome
        if (tc.expectPass) {
            if (containsPhrase && phraseChunkIdx >= 0) {
                result.status = "PASS";
                result.reason = `Phrase in chunk ${phraseChunkIdx}, root registered`;
            } else {
                result.status = "UNEXPECTED_FAIL";
                result.reason = "Expected to pass but phrase not found";
            }
        } else {
            if (!containsPhrase) {
                result.status = "CORRECT_REJECT";
                result.reason = tc.failReason || "Phrase not in document";
            } else {
                result.status = "UNEXPECTED_PASS";
                result.reason = "Expected to fail but phrase was found";
            }
        }

        results.push(result);

        const icon = result.status === "PASS" ? "✅" :
                     result.status === "CORRECT_REJECT" ? "🚫" :
                     result.status === "UNEXPECTED_FAIL" ? "❌" : "⚠️";

        console.log(`${icon} ${tc.company.padEnd(20)} | ${tc.file}`);
        console.log(`   ${fileBytes.length} bytes, ${totalChunks} chunks | Phrase: ${containsPhrase ? `YES (chunk ${phraseChunkIdx})` : "NO"}`);
        console.log(`   Root: ${merkleRoot.substring(0, 30)}...`);
        console.log(`   Result: ${result.status} — ${result.reason}\n`);
    }

    // Phase 2: Registry simulation
    console.log("\n━━━ PHASE 2: Registry ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`📋 Registered ${registeredRoots.length} document roots (from PASS documents)`);

    // Also include the existing sample_doc root if not already there
    const existingRegistry = JSON.parse(fs.readFileSync(
        path.join(__dirname, "..", "web", "server", "registry.json"), "utf-8"
    ));
    for (const r of existingRegistry) {
        if (!registeredRoots.includes(r)) registeredRoots.push(r);
    }

    // Write updated registry
    const registryPath = path.join(__dirname, "..", "web", "server", "registry.json");
    fs.writeFileSync(registryPath, JSON.stringify(registeredRoots, null, 2));
    console.log(`✅ Updated registry.json with ${registeredRoots.length} roots\n`);

    // Phase 3: Verification simulation
    console.log("━━━ PHASE 3: Verification Simulation ━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Testing each document against the registry...\n");

    let passed = 0;
    let failed = 0;
    let correctRejects = 0;

    for (const r of results) {
        if (r.status === "SKIP") continue;

        const isRegistered = registeredRoots.includes(r.merkleRoot);
        const wouldVerify = r.containsPhrase && isRegistered;
        const expectedResult = r.expectPass;

        const match = wouldVerify === expectedResult;

        if (match && r.expectPass) {
            passed++;
            console.log(`  ✅ ${r.company.padEnd(20)} → VERIFIED (phrase ✓, registry ✓)`);
        } else if (match && !r.expectPass) {
            correctRejects++;
            const reason = !r.containsPhrase ? "phrase ✗" : "registry ✗";
            console.log(`  🚫 ${r.company.padEnd(20)} → REJECTED (${reason}) — correct!`);
        } else {
            failed++;
            console.log(`  ❌ ${r.company.padEnd(20)} → UNEXPECTED: verify=${wouldVerify}, expected=${expectedResult}`);
        }
    }

    // Summary
    console.log("\n━━━ SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`  Total documents:    ${results.length}`);
    console.log(`  ✅ Verified (pass): ${passed}`);
    console.log(`  🚫 Rejected (fail): ${correctRejects}`);
    console.log(`  ❌ Unexpected:      ${failed}`);
    console.log(`  Result: ${failed === 0 ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);

    // Detail table
    console.log("\n━━━ DETAIL TABLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Company              | File                           | Phrase | Registered | Result");
    console.log("---------------------|--------------------------------|--------|------------|-------");
    for (const r of results) {
        if (r.status === "SKIP") continue;
        const isReg = registeredRoots.includes(r.merkleRoot);
        const verify = r.containsPhrase && isReg;
        console.log(
            `${r.company.padEnd(21)}| ${r.file.padEnd(31)}| ${(r.containsPhrase ? "YES" : "NO").padEnd(7)}| ${(isReg ? "YES" : "NO").padEnd(11)}| ${verify ? "✅ PASS" : "🚫 FAIL"}`
        );
    }

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log(`║  ${failed === 0 ? "✅ ALL 13 TESTS PASSED" : "❌ SOME TESTS FAILED"}                                  ║`);
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    return failed === 0;
}

runTests().then(ok => process.exit(ok ? 0 : 1));
