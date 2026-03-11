/**
 * signRoot.js — Company-X Merkle Root Signer
 * 
 * Loads the Company-X private key and signs the Merkle root from 
 * merkle_data.json using EdDSA (Poseidon-based) on Baby Jubjub.
 * 
 * This simulates Company-X attesting to a document's authenticity
 * by signing its Merkle root.
 * 
 * Usage: node scripts/signRoot.js
 * Requires: keys/company_x.private.json, input/merkle_data.json
 * Output: input/signature.json
 * 
 * Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
 */

const fs = require("fs");
const path = require("path");
const circomlibjs = require("circomlibjs");

async function main() {
    console.log("✍️  Signing Merkle Root with Company-X key...\n");

    // Load private key
    const keysDir = path.join(__dirname, "..", "keys");
    const privKeyData = JSON.parse(fs.readFileSync(path.join(keysDir, "company_x.private.json")));
    const privateKey = Buffer.from(privKeyData.privateKey, "hex");

    // Load Merkle data
    const inputDir = path.join(__dirname, "..", "input");
    const merkleData = JSON.parse(fs.readFileSync(path.join(inputDir, "merkle_data.json")));
    const merkleRoot = BigInt(merkleData.merkleRoot);

    console.log(`   Merkle Root: ${merkleRoot.toString().substring(0, 30)}...`);

    // Build EdDSA and sign
    const eddsa = await circomlibjs.buildEddsa();
    const babyJub = await circomlibjs.buildBabyjub();
    const F = babyJub.F;

    // EdDSA-Poseidon sign: the message is the Merkle root
    const signature = eddsa.signPoseidon(privateKey, F.e(merkleRoot));

    // Extract signature components
    const R8x = F.toObject(signature.R8[0]).toString();
    const R8y = F.toObject(signature.R8[1]).toString();
    const S = signature.S.toString();

    // Also get the public key for verification
    const pubKey = eddsa.prv2pub(privateKey);
    const Ax = F.toObject(pubKey[0]).toString();
    const Ay = F.toObject(pubKey[1]).toString();

    console.log(`   Signature R8x: ${R8x.substring(0, 20)}...`);
    console.log(`   Signature R8y: ${R8y.substring(0, 20)}...`);
    console.log(`   Signature S:   ${S.substring(0, 20)}...`);

    // Verify signature locally (sanity check)
    const valid = eddsa.verifyPoseidon(F.e(merkleRoot), signature, pubKey);
    console.log(`\n   Local verification: ${valid ? "✅ PASS" : "❌ FAIL"}`);

    if (!valid) {
        console.error("   Signature verification failed! Something is wrong.");
        process.exit(1);
    }

    // Save signature
    const sigOutput = {
        merkleRoot: merkleRoot.toString(),
        R8x: R8x,
        R8y: R8y,
        S: S,
        Ax: Ax,
        Ay: Ay,
        description: "EdDSA-Poseidon signature by Company-X over the Merkle root"
    };

    const outPath = path.join(inputDir, "signature.json");
    fs.writeFileSync(outPath, JSON.stringify(sigOutput, null, 2));
    console.log(`\n💾 Signature saved to: ${outPath}`);
}

main().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
