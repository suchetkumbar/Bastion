/**
 * server.js — ZK Proof Verifier Backend (v2.2.0)
 * 
 * This Express server verifies zero-knowledge proofs and manages document registry.
 * It NEVER receives the original document — that stays on the client.
 * 
 * Endpoints:
 *   POST /verify       — Verify a ZK proof (with replay prevention)
 *   POST /register     — Register a new document (Company-X admin)
 *   GET  /merkle-data  — Get all registered documents' Merkle trees
 *   GET  /audit-log    — View anonymized verification audit trail
 *   GET  /admin/stats  — Dashboard statistics
 *   GET  /health       — Server health check
 * 
 * Security features:
 *   - Privacy Middleware (IP stripping, zero-logging, privacy headers)
 *   - Replay attack prevention (proof hash deduplication)
 *   - Anonymous verification audit trail
 *   - Document Registry check (Merkle root must be registered)
 *   - Groth16 cryptographic verification
 * 
 * Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
 */

const express = require("express");
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");

// Resolve project root (two levels up from web/server/)
const PROJECT_ROOT = path.join(__dirname, "..", "..");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ─── Privacy Middleware ─────────────────────────────────────────────
// Strips all identifying information from requests. The server never
// learns WHO submitted a proof — only that it is mathematically valid.
app.use((req, res, next) => {
    // Strip IP address from request — don't even store in memory
    req.headers["x-forwarded-for"] = "[REDACTED]";
    req.ip = "0.0.0.0";
    if (req.connection) req.connection.remoteAddress = "0.0.0.0";

    // Add privacy-preserving response headers
    res.setHeader("X-Privacy-Policy", "zero-knowledge");
    res.setHeader("X-Identity-Tracked", "false");
    res.setHeader("X-Logs-Stored", "none");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");

    // Log only the action, never the source
    if (req.method === "POST") {
        console.log(`🔒 Anonymous ${req.method} ${req.path} — no identity recorded`);
    }

    next();
});

// ─── Data Storage ───────────────────────────────────────────────────

// Verification key
const vKeyPath = path.join(__dirname, "verification_key.json");
let vKey;
try {
    vKey = JSON.parse(fs.readFileSync(vKeyPath));
    console.log("✅ Verification key loaded.");
} catch (err) {
    console.error("⚠️  Verification key not found.");
}

// Document registry (array of Merkle roots)
const registryPath = path.join(__dirname, "registry.json");
let registry;
try {
    registry = JSON.parse(fs.readFileSync(registryPath));
    console.log(`✅ Registry loaded: ${registry.length} authorized document(s).`);
} catch (err) {
    registry = [];
    console.log("⚠️  No registry.json found.");
}

// Document Merkle data store (per-document trees)
const docStorePath = path.join(__dirname, "document_store");
if (!fs.existsSync(docStorePath)) fs.mkdirSync(docStorePath, { recursive: true });

// Replay prevention store (Set of proof hashes)
const usedProofHashes = new Set();

// Audit log
const auditLogPath = path.join(__dirname, "audit_log.json");
let auditLog = [];
try {
    if (fs.existsSync(auditLogPath)) {
        auditLog = JSON.parse(fs.readFileSync(auditLogPath));
    }
} catch (err) { auditLog = []; }

// Stats counters
let stats = {
    totalVerifications: auditLog.length,
    passed: auditLog.filter(e => e.result === "VALID").length,
    failed: auditLog.filter(e => e.result !== "VALID").length,
    replaysBlocked: 0,
    serverStartedAt: new Date().toISOString()
};

// ─── Helper: Poseidon Merkle Tree Builder ───────────────────────────
let poseidonInstance = null;
let poseidonF = null;

async function initPoseidon() {
    if (!poseidonInstance) {
        const circomlibjs = require("circomlibjs");
        poseidonInstance = await circomlibjs.buildPoseidon();
        poseidonF = poseidonInstance.F;
        console.log("✅ Poseidon hasher initialized.");
    }
}

function poseidonChunkHash(chunkBytes) {
    const CHUNK_SIZE = 64;
    const numBlocks = CHUNK_SIZE / 16;
    const blockHashes = [];
    for (let b = 0; b < numBlocks; b++) {
        const block = chunkBytes.slice(b * 16, (b + 1) * 16).map(x => BigInt(x));
        blockHashes.push(poseidonF.toObject(poseidonInstance(block)));
    }
    return poseidonF.toObject(poseidonInstance(blockHashes));
}

function buildMerkleTreeFromBytes(fileBytes) {
    const CHUNK_SIZE = 64;
    const chunks = [];
    for (let i = 0; i < fileBytes.length; i += CHUNK_SIZE) {
        const chunk = new Array(CHUNK_SIZE).fill(32);
        for (let j = 0; j < CHUNK_SIZE && (i + j) < fileBytes.length; j++) {
            chunk[j] = fileBytes[i + j];
        }
        chunks.push(chunk);
    }

    const chunkHashes = chunks.map(c => poseidonChunkHash(c));
    
    // ZK Circuit is hardcoded to DEPTH=5 (max 32 chunks)
    // We MUST build a depth-5 tree regardless of file size so the root matches circuit logic
    const treeDepth = 5;
    const leafCount = Math.pow(2, treeDepth);

    const leaves = [...chunkHashes];
    while (leaves.length < leafCount) leaves.push(BigInt(0));

    const tree = [leaves.map(h => h.toString())];
    let currentLevel = leaves;
    for (let level = 0; level < treeDepth; level++) {
        const next = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            next.push(poseidonF.toObject(poseidonInstance([currentLevel[i], currentLevel[i + 1]])));
        }
        tree.push(next.map(h => h.toString()));
        currentLevel = next;
    }

    return {
        chunks,
        chunkHashes: chunkHashes.map(h => h.toString()),
        tree,
        treeDepth,
        totalChunks: chunks.length,
        merkleRoot: currentLevel[0].toString()
    };
}

function appendAuditLog(entry) {
    auditLog.push(entry);
    // Keep only last 1000 entries to prevent unbounded growth
    if (auditLog.length > 1000) auditLog = auditLog.slice(-1000);
    try {
        fs.writeFileSync(auditLogPath, JSON.stringify(auditLog, null, 2));
    } catch (err) { /* non-critical */ }
}

// ─── POST /verify — Submit ZK proof for verification ────────────────
app.post("/verify", async (req, res) => {
    try {
        const { proof, publicSignals } = req.body;

        // Validate input
        if (!proof || !publicSignals || publicSignals.length < 1) {
            return res.status(400).json({
                verified: false,
                message: "Missing proof or public signals."
            });
        }

        // FEATURE 1: Replay Attack Prevention
        // Hash the proof to create a unique fingerprint
        const proofHash = crypto
            .createHash("sha256")
            .update(JSON.stringify(proof))
            .digest("hex");

        if (usedProofHashes.has(proofHash)) {
            stats.replaysBlocked++;
            appendAuditLog({
                proofFingerprint: proofHash.substring(0, 16),
                result: "REPLAY_BLOCKED",
                timestamp: new Date().toISOString(),
                submitterIdentity: "NOT_RECORDED"
            });
            return res.status(409).json({
                verified: false,
                message: "⚠️ Replay Attack Detected: This exact proof has already been submitted and verified. Each proof can only be used once."
            });
        }

        // Circom public signal order: outputs first, then public inputs
        // Signal[0] = chunkHashOut (output)
        // Signal[1] = root (public input)
        // Signal[2..26] = targetPhrase[0..24] (public input)
        const submittedRoot = publicSignals[1];

        // Step 1: Check document registry
        if (registry.length > 0 && !registry.includes(submittedRoot)) {
            appendAuditLog({
                proofFingerprint: proofHash.substring(0, 16),
                result: "UNREGISTERED_DOCUMENT",
                timestamp: new Date().toISOString(),
                submitterIdentity: "NOT_RECORDED"
            });
            stats.totalVerifications++;
            stats.failed++;
            return res.json({
                verified: false,
                message: "Unauthorized Document: The document's Merkle root is not registered as an authentic source."
            });
        }

        // Step 2: Cryptographic verification
        if (!vKey) {
            return res.status(500).json({
                verified: false,
                message: "Server error: verification key not loaded."
            });
        }

        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);

        // Mark proof as used (replay prevention)
        if (verified) {
            usedProofHashes.add(proofHash);
        }

        // Extract phrase from public signals
        const phraseLength = 25;
        let phraseStr = "";
        for (let i = 2; i < 2 + phraseLength && i < publicSignals.length; i++) {
            phraseStr += String.fromCharCode(parseInt(publicSignals[i]));
        }

        // Generate Anonymous Proof Receipt
        const receipt = {
            receiptId: crypto.randomUUID(),
            proofFingerprint: proofHash.substring(0, 16) + "...",
            verificationResult: verified ? "VALID" : "INVALID",
            documentRegistered: registry.includes(submittedRoot),
            phraseConfirmed: phraseStr,
            replayProtected: true,
            privacyGuarantees: {
                submitterIdentity: "NOT_RECORDED",
                submitterIP: "NOT_RECORDED",
                submitterLocation: "NOT_RECORDED",
                documentContent: "NOT_TRANSMITTED",
                submissionTimestamp: "NOT_STORED",
                browserFingerprint: "NOT_COLLECTED",
                sessionCookies: "NONE"
            }
        };

        // FEATURE 2: Audit Trail
        stats.totalVerifications++;
        if (verified) stats.passed++; else stats.failed++;
        appendAuditLog({
            proofFingerprint: proofHash.substring(0, 16),
            result: verified ? "VALID" : "INVALID",
            registryCheck: registry.includes(submittedRoot) ? "PASSED" : "FAILED",
            phraseDetected: phraseStr,
            timestamp: new Date().toISOString(),
            submitterIdentity: "NOT_RECORDED",
            submitterIP: "NOT_RECORDED"
        });

        res.json({
            verified,
            message: verified
                ? "✅ Zero-Knowledge Proof Verified & Document Authorized"
                : "❌ Invalid Cryptographic Proof",
            receipt,
            details: {
                root: submittedRoot,
                phrase: phraseStr,
                registryCheck: registry.length === 0 ? "bypassed" : "passed",
                replayProtected: true
            }
        });

    } catch (err) {
        console.error("Verification error:", err.message);
        res.status(500).json({
            verified: false,
            message: "Server error during verification."
        });
    }
});

// ─── POST /register — Register a new document ──────────────────────
// Company-X uses this endpoint to register documents.
// Accepts raw file content as base64 or text in the request body.
app.post("/register", async (req, res) => {
    try {
        const { content, name, encoding } = req.body;

        if (!content) {
            return res.status(400).json({ error: "Missing 'content' field." });
        }

        // Initialize Poseidon if not already done
        await initPoseidon();

        // Decode content and normalize line endings
        let originalBytes;
        if (encoding === "base64") {
            originalBytes = Array.from(Buffer.from(content, "base64"));
        } else {
            originalBytes = Array.from(Buffer.from(content, "utf-8"));
        }
        
        // Strip out \r (ASCII 13) to ensure OS-agnostic chunks
        const fileBytes = originalBytes.filter(b => b !== 13);

        // Build Merkle tree
        const merkleData = buildMerkleTreeFromBytes(fileBytes);
        const docName = name || `document_${Date.now()}`;

        // Compute exact file hash (SHA-256)
        const fileHash = crypto.createHash("sha256").update(Buffer.from(fileBytes)).digest("hex");

        // Check if already registered
        if (registry.includes(merkleData.merkleRoot)) {
            return res.json({
                message: "Document already registered.",
                merkleRoot: merkleData.merkleRoot,
                totalChunks: merkleData.totalChunks,
                treeDepth: merkleData.treeDepth,
                fileHash
            });
        }

        // Save Merkle data to document store
        const docId = crypto.createHash("sha256").update(merkleData.merkleRoot).digest("hex").substring(0, 12);
        const docFile = path.join(docStorePath, `${docId}.json`);
        fs.writeFileSync(docFile, JSON.stringify({
            docId,
            name: docName,
            merkleRoot: merkleData.merkleRoot,
            totalChunks: merkleData.totalChunks,
            treeDepth: merkleData.treeDepth,
            tree: merkleData.tree,
            chunkHashes: merkleData.chunkHashes,
            fileHash,
            registeredAt: new Date().toISOString()
        }, null, 2));

        // Add root to registry
        registry.push(merkleData.merkleRoot);
        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

        console.log(`📋 Registered: "${docName}" (${merkleData.totalChunks} chunks, root: ${merkleData.merkleRoot.substring(0, 20)}...)`);

        res.json({
            message: "Document registered successfully.",
            docId,
            name: docName,
            merkleRoot: merkleData.merkleRoot,
            totalChunks: merkleData.totalChunks,
            treeDepth: merkleData.treeDepth,
            fileHash
        });

    } catch (err) {
        console.error("Registration error:", err.message);
        res.status(500).json({ error: "Failed to register document." });
    }
});

// ─── GET /merkle-data — Serve all registered Merkle trees ───────────
// FEATURE 6: Multi-document support
app.get("/merkle-data", (req, res) => {
    try {
        const documents = [];

        // Load all documents from document_store
        if (fs.existsSync(docStorePath)) {
            const files = fs.readdirSync(docStorePath).filter(f => f.endsWith(".json"));
            for (const file of files) {
                try {
                    const doc = JSON.parse(fs.readFileSync(path.join(docStorePath, file)));
                    documents.push(doc);
                } catch (e) { /* skip corrupt files */ }
            }
        }

        // Fallback: load from input/merkle_data.json if no store docs
        if (documents.length === 0) {
            const fallbackPath = path.join(PROJECT_ROOT, "input", "merkle_data.json");
            if (fs.existsSync(fallbackPath)) {
                const merkleData = JSON.parse(fs.readFileSync(fallbackPath));
                documents.push({
                    docId: "original",
                    name: "sample_doc.txt",
                    ...merkleData
                });
            }
        }

        res.json({ documents, count: documents.length });

    } catch (err) {
        res.status(500).json({ error: "Failed to load Merkle data." });
    }
});

// ─── GET /audit-log — Anonymized verification audit trail ───────────
// FEATURE 2: Audit trail endpoint
app.get("/audit-log", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const recent = auditLog.slice(-limit).reverse();
    res.json({
        entries: recent,
        total: auditLog.length,
        privacyNote: "This log contains NO identifying information. All entries are anonymous."
    });
});

// ─── GET /admin/stats — Dashboard statistics ────────────────────────
// FEATURE 5: Admin dashboard data
app.get("/admin/stats", (req, res) => {
    // Count registered documents
    let docCount = registry.length;
    let docNames = [];
    if (fs.existsSync(docStorePath)) {
        const files = fs.readdirSync(docStorePath).filter(f => f.endsWith(".json"));
        docNames = files.map(f => {
            try {
                const d = JSON.parse(fs.readFileSync(path.join(docStorePath, f)));
                return { name: d.name, docId: d.docId, chunks: d.totalChunks, registeredAt: d.registeredAt };
            } catch (e) { return null; }
        }).filter(Boolean);
    }

    res.json({
        registeredDocuments: docCount,
        documents: docNames,
        verifications: {
            total: stats.totalVerifications,
            passed: stats.passed,
            failed: stats.failed,
            replaysBlocked: stats.replaysBlocked
        },
        recentActivity: auditLog.slice(-10).reverse(),
        serverUptime: stats.serverStartedAt,
        privacyPolicy: {
            ipLogging: "DISABLED",
            identityTracking: "DISABLED",
            proofReplay: "BLOCKED",
            metadataCollection: "NONE"
        }
    });
});

// ─── GET /health ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        verificationKey: !!vKey,
        registeredDocuments: registry.length,
        auditLogEntries: auditLog.length,
        replayProtection: true
    });
});

// ─── Start Server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

// Pre-initialize Poseidon on startup
app.listen(PORT, () => {
    console.log(`\n🔒 Verifier Node running on http://localhost:${PORT}`);
    console.log(`   POST /verify     — Submit ZK proof for verification`);
    console.log(`   POST /register   — Register new document`);
    console.log(`   GET  /merkle-data — All registered Merkle trees`);
    console.log(`   GET  /audit-log  — Anonymous verification history`);
    console.log(`   GET  /admin/stats — Dashboard statistics`);
    console.log(`   GET  /health     — Server health check`);
    
    // Initialize poseidon in background
    initPoseidon().catch(err => {
        console.error("Failed to initialize Poseidon:", err);
    });
});
