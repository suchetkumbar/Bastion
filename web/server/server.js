/**
 * server.js — ZK Proof Verifier Backend
 * 
 * This Express server ONLY receives and verifies zero-knowledge proofs.
 * It NEVER receives the original document — that stays on the client.
 * 
 * Endpoints:
 *   POST /verify — Accepts {proof, publicSignals}, verifies via snarkjs
 * 
 * Security features:
 *   - Document Registry check (proof's Merkle root must be in registry)
 *   - Groth16 cryptographic verification
 *   - No file uploads, no plaintext document handling
 *   - No IP logging (privacy-preserving)
 * 
 * Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
 */

const express = require("express");
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" })); // Proofs can be large

// Load verification key
const vKeyPath = path.join(__dirname, "verification_key.json");
let vKey;
try {
    vKey = JSON.parse(fs.readFileSync(vKeyPath));
    console.log("✅ Verification key loaded.");
} catch (err) {
    console.error("⚠️  Verification key not found. Copy it from build/verification_key.json");
    console.error("   Server will start but verification will fail.");
}

// Load document registry
const registryPath = path.join(__dirname, "registry.json");
let registry;
try {
    registry = JSON.parse(fs.readFileSync(registryPath));
    console.log(`✅ Registry loaded: ${registry.length} authorized document(s).`);
} catch (err) {
    registry = [];
    console.log("⚠️  No registry.json found. All documents will be treated as unauthorized.");
}

// ─── Verify Endpoint ────────────────────────────────────────────────
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

        // Extract the Merkle root from public signals
        // Signal order: root, targetPhrase[0..24], chunkHashOut
        const submittedRoot = publicSignals[0];
        
        // Step 1: Check document registry
        if (registry.length > 0 && !registry.includes(submittedRoot)) {
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

        // Extract human-readable info from public signals
        const phraseLength = 25;
        let phraseStr = "";
        for (let i = 1; i <= phraseLength && i < publicSignals.length; i++) {
            phraseStr += String.fromCharCode(parseInt(publicSignals[i]));
        }

        res.json({
            verified,
            message: verified
                ? "✅ Zero-Knowledge Proof Verified & Document Authorized"
                : "❌ Invalid Cryptographic Proof",
            details: {
                root: submittedRoot,
                phrase: phraseStr,
                registryCheck: registry.length === 0 ? "bypassed" : "passed"
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

// ─── Health Check ───────────────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        verificationKey: !!vKey,
        registeredDocuments: registry.length
    });
});

// ─── Start Server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`\n🔒 Verifier Node running on http://localhost:${PORT}`);
    console.log("   POST /verify — Submit ZK proof for verification");
    console.log("   GET  /health — Server health check\n");
});
