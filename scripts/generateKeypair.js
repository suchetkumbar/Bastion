/**
 * generateKeypair.js — Company-X EdDSA Keypair Generator
 * 
 * Generates an EdDSA keypair on the Baby Jubjub curve using circomlibjs.
 * This simulates Company-X creating a signing identity.
 * 
 * In production, the company would use an HSM or secure key management system.
 * For this demo, we generate and save keys to the keys/ directory.
 * 
 * Usage: node scripts/generateKeypair.js
 * Output: keys/company_x.private.json, keys/company_x.public.json
 * 
 * Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
 */

const fs = require("fs");
const path = require("path");
const circomlibjs = require("circomlibjs");
const crypto = require("crypto");

async function main() {
    console.log("🔐 Generating Company-X EdDSA Keypair (Baby Jubjub)...\n");

    // Build the EdDSA module with Poseidon
    const eddsa = await circomlibjs.buildEddsa();
    const babyJub = await circomlibjs.buildBabyjub();
    const F = babyJub.F;

    // Generate a random 32-byte private key
    const privateKey = crypto.randomBytes(32);
    console.log(`   Private key (hex): ${privateKey.toString("hex").substring(0, 16)}...`);

    // Derive public key
    const pubKey = eddsa.prv2pub(privateKey);
    const pubKeyX = F.toObject(pubKey[0]).toString();
    const pubKeyY = F.toObject(pubKey[1]).toString();

    console.log(`   Public key Ax: ${pubKeyX.substring(0, 20)}...`);
    console.log(`   Public key Ay: ${pubKeyY.substring(0, 20)}...`);

    // Save keys
    const keysDir = path.join(__dirname, "..", "keys");
    if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });

    const privatePath = path.join(keysDir, "company_x.private.json");
    const publicPath = path.join(keysDir, "company_x.public.json");

    fs.writeFileSync(privatePath, JSON.stringify({
        privateKey: privateKey.toString("hex"),
        description: "Company-X EdDSA private key (Baby Jubjub). KEEP SECRET."
    }, null, 2));

    fs.writeFileSync(publicPath, JSON.stringify({
        Ax: pubKeyX,
        Ay: pubKeyY,
        description: "Company-X EdDSA public key (Baby Jubjub). Safe to publish."
    }, null, 2));

    console.log(`\n✅ Keys saved:`);
    console.log(`   Private: ${privatePath}`);
    console.log(`   Public:  ${publicPath}`);
    console.log(`\n⚠️  In production, the private key must be stored in an HSM.`);
}

main().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
