/**
 * registerAllDocs.js — Register all test documents via the /register API
 * Run once to populate the document_store for multi-document support.
 */
const fs = require("fs");
const path = require("path");

const SERVER = "http://localhost:4000";

const docsToRegister = [
    { file: path.join(__dirname, "..", "sample_doc.txt"), name: "sample_doc.txt" },
    { file: path.join(__dirname, "..", "test_documents", "pass_acmechem_memo.txt"), name: "AcmeChem Internal Memo" },
    { file: path.join(__dirname, "..", "test_documents", "pass_petroglobe_report.txt"), name: "PetroGlobe Compliance Report" },
    { file: path.join(__dirname, "..", "test_documents", "pass_novapharma_audit.txt"), name: "NovaPharma Audit Report" },
    { file: path.join(__dirname, "..", "test_documents", "pass_steelworks_assessment.txt"), name: "SteelWorks EIA" },
    { file: path.join(__dirname, "..", "test_documents", "pass_agricorp_memo.txt"), name: "AgriCorp Pesticide Memo" },
    { file: path.join(__dirname, "..", "test_documents", "pass_minecore_memo.txt"), name: "MineCore Tailings Memo" },
];

async function registerAll() {
    console.log("Registering documents via /register API...\n");

    for (const doc of docsToRegister) {
        try {
            const content = fs.readFileSync(doc.file);
            const b64 = content.toString("base64");

            const res = await fetch(`${SERVER}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: b64, name: doc.name, encoding: "base64" })
            });

            const data = await res.json();
            console.log(`✅ ${doc.name.padEnd(35)} | ${data.totalChunks} chunks | root: ${data.merkleRoot?.substring(0, 20)}...`);
        } catch (err) {
            console.log(`❌ ${doc.name}: ${err.message}`);
        }
    }

    // Verify via /admin/stats
    const statsRes = await fetch(`${SERVER}/admin/stats`);
    const stats = await statsRes.json();
    console.log(`\n📋 Total registered: ${stats.registeredDocuments} documents`);
    console.log("✅ Done!");
}

registerAll();
