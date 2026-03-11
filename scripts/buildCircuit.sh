#!/bin/bash
# =============================================================================
# buildCircuit.sh — Circuit Compilation & Groth16 Trusted Setup
#
# This script compiles the Circom circuit, performs the Groth16 trusted setup,
# and exports the verification key. Run this in WSL2 Ubuntu.
#
# Prerequisites:
#   - circom v2 installed (https://docs.circom.io/getting-started/installation/)
#   - snarkjs installed globally (npm install -g snarkjs)
#   - A Powers of Tau file (pot15_final.ptau)
#
# Usage (from project root in WSL2):
#   bash scripts/buildCircuit.sh
#
# Authors: Abhilash Purohit, Suchet Kumbar, Pratik Anand
# =============================================================================

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
CIRCUIT="$PROJECT_ROOT/circuits/whistleblower.circom"
PTAU_FILE="$PROJECT_ROOT/pot15_final.ptau"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Circuit Build Pipeline (Circom + Groth16)           ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# --- Step 0: Check prerequisites ---
if ! command -v circom &> /dev/null; then
    echo "❌ circom not found. Install it:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "   git clone https://github.com/iden3/circom.git"
    echo "   cd circom && cargo build --release && cargo install --path circom"
    exit 1
fi

if ! command -v snarkjs &> /dev/null; then
    echo "❌ snarkjs not found. Install it:"
    echo "   npm install -g snarkjs"
    exit 1
fi

# --- Step 1: Download PTAU if needed ---
if [ ! -f "$PTAU_FILE" ]; then
    echo "📦 Downloading Powers of Tau file (pot15_final.ptau, ~53MB)..."
    echo "   This is a one-time download for circuits up to 2^15 constraints."
    curl -L -o "$PTAU_FILE" \
        "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau"
    echo "   ✅ PTAU file downloaded."
else
    echo "✅ PTAU file found: $PTAU_FILE"
fi

# --- Step 2: Compile the circuit ---
echo ""
echo "⚙️  Step 1/4: Compiling circuit..."
mkdir -p "$BUILD_DIR"
circom "$CIRCUIT" \
    --r1cs \
    --wasm \
    --sym \
    -o "$BUILD_DIR" \
    -l "$PROJECT_ROOT/node_modules"

echo "   ✅ Compilation complete."
echo "   R1CS: $BUILD_DIR/whistleblower.r1cs"
echo "   WASM: $BUILD_DIR/whistleblower_js/whistleblower.wasm"

# Print circuit info
echo ""
echo "📊 Circuit information:"
snarkjs r1cs info "$BUILD_DIR/whistleblower.r1cs"

# --- Step 3: Groth16 setup ---
echo ""
echo "⚙️  Step 2/4: Groth16 trusted setup (Phase 2)..."
snarkjs groth16 setup \
    "$BUILD_DIR/whistleblower.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/circuit_0000.zkey"

echo "   ✅ Initial setup complete."

# --- Step 4: Contribute to the ceremony ---
echo ""
echo "⚙️  Step 3/4: Contributing to trusted setup ceremony..."
snarkjs zkey contribute \
    "$BUILD_DIR/circuit_0000.zkey" \
    "$BUILD_DIR/circuit_final.zkey" \
    --name="CNS Project Contribution" \
    -v -e="some random entropy for the ceremony $(date)"

echo "   ✅ Contribution complete."

# --- Step 5: Export verification key ---
echo ""
echo "⚙️  Step 4/4: Exporting verification key..."
snarkjs zkey export verificationkey \
    "$BUILD_DIR/circuit_final.zkey" \
    "$BUILD_DIR/verification_key.json"

echo "   ✅ Verification key exported."

# --- Optional: Export Solidity verifier ---
echo ""
echo "📝 Exporting Solidity verifier contract (optional)..."
mkdir -p "$PROJECT_ROOT/contracts"
snarkjs zkey export solidityverifier \
    "$BUILD_DIR/circuit_final.zkey" \
    "$PROJECT_ROOT/contracts/Verifier.sol"
echo "   ✅ Solidity verifier: $PROJECT_ROOT/contracts/Verifier.sol"

# --- Copy WASM + zkey to web client for browser proving ---
echo ""
echo "📋 Copying artifacts to web/client/public/ for browser proving..."
WEB_PUBLIC="$PROJECT_ROOT/web/client/public"
mkdir -p "$WEB_PUBLIC"
cp "$BUILD_DIR/whistleblower_js/whistleblower.wasm" "$WEB_PUBLIC/"
cp "$BUILD_DIR/circuit_final.zkey" "$WEB_PUBLIC/"
echo "   ✅ Copied whistleblower.wasm and circuit_final.zkey"

# --- Summary ---
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   ✅ BUILD COMPLETE                                    ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "   Files generated:"
echo "   ├── build/whistleblower.r1cs"
echo "   ├── build/whistleblower_js/whistleblower.wasm"
echo "   ├── build/whistleblower.sym"
echo "   ├── build/circuit_final.zkey"
echo "   ├── build/verification_key.json"
echo "   ├── contracts/Verifier.sol"
echo "   └── web/client/public/{whistleblower.wasm, circuit_final.zkey}"
echo ""
echo "   Next steps:"
echo "   1. Run 'npm run demo' to test the full pipeline"
echo "   2. Run 'npm run server' to start the verifier"
echo "   3. Run 'npm run client' to start the web app"
echo ""
