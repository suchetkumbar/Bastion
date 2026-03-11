pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";

// ============================================================================
// TEMPLATE: SubstringMatcher
// Proves that an M-byte phrase exists as a contiguous substring inside an
// N-byte chunk using a sliding window of IsEqual() comparators.
//
// Inputs:  chunk[N] (private), phrase[M] (public)
// Output:  found (1 if phrase is in chunk, 0 otherwise)
// Constraints: ~N*M IsEqual + N-M+1 aggregation comparators
// ============================================================================
template SubstringMatcher(N, M) {
    signal input chunk[N];
    signal input phrase[M];
    signal output found;

    var num_windows = N - M + 1;

    // --- Character-level equality per window ---
    signal char_match[num_windows][M];
    component is_equal[num_windows][M];

    for (var w = 0; w < num_windows; w++) {
        for (var c = 0; c < M; c++) {
            is_equal[w][c] = IsEqual();
            is_equal[w][c].in[0] <== chunk[w + c];
            is_equal[w][c].in[1] <== phrase[c];
            char_match[w][c] <== is_equal[w][c].out;
        }
    }

    // --- Window-level: all M chars must match ---
    signal window_sum[num_windows];
    signal window_match[num_windows];
    component window_cmp[num_windows];

    for (var w = 0; w < num_windows; w++) {
        var s = 0;
        for (var c = 0; c < M; c++) {
            s += char_match[w][c];
        }
        window_sum[w] <== s;

        window_cmp[w] = IsEqual();
        window_cmp[w].in[0] <== window_sum[w];
        window_cmp[w].in[1] <== M;
        window_match[w] <== window_cmp[w].out;
    }

    // --- Accumulate: at least one window must match ---
    signal running_total[num_windows];
    running_total[0] <== window_match[0];
    for (var w = 1; w < num_windows; w++) {
        running_total[w] <== running_total[w-1] + window_match[w];
    }

    component found_cmp = GreaterThan(16);
    found_cmp.in[0] <== running_total[num_windows - 1];
    found_cmp.in[1] <== 0;
    found <== found_cmp.out;
}

// ============================================================================
// TEMPLATE: PoseidonChunkHasher
// Hashes a full N-byte chunk by splitting it into blocks of 16,
// hashing each block with Poseidon(16), then combining the intermediate
// hashes with a final Poseidon call.
//
// For N=64: 4 blocks of 16 → 4 hashes → Poseidon(4) → chunkHash
// ============================================================================
template PoseidonChunkHasher(N) {
    signal input bytes[N];
    signal output out;

    // Number of 16-byte blocks (N must be a multiple of 16)
    var NUM_BLOCKS = N \ 16;

    // Hash each block of 16 bytes
    component block_hasher[NUM_BLOCKS];
    for (var b = 0; b < NUM_BLOCKS; b++) {
        block_hasher[b] = Poseidon(16);
        for (var i = 0; i < 16; i++) {
            block_hasher[b].inputs[i] <== bytes[b * 16 + i];
        }
    }

    // Combine block hashes into a single hash
    component final_hasher = Poseidon(NUM_BLOCKS);
    for (var b = 0; b < NUM_BLOCKS; b++) {
        final_hasher.inputs[b] <== block_hasher[b].out;
    }

    out <== final_hasher.out;
}

// ============================================================================
// TEMPLATE: MerkleTreeChecker
// Verifies a Merkle inclusion proof using Poseidon(2) at each level.
// Given a leaf hash, path elements, and path indices (left=0, right=1),
// computes the root and checks it matches the expected root.
// ============================================================================
template MerkleTreeChecker(depth) {
    signal input leaf;
    signal input root;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // At each level, hash (left, right) where the order depends on pathIndex
    component hashers[depth];
    component mux_left[depth];
    component mux_right[depth];

    signal computed[depth + 1];
    computed[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // pathIndices[i] == 0 means current node is LEFT child
        // pathIndices[i] == 1 means current node is RIGHT child

        // left = pathIndices[i] == 0 ? computed[i] : pathElements[i]
        // right = pathIndices[i] == 0 ? pathElements[i] : computed[i]

        // Multiplexer: swap based on pathIndices[i]
        // left  = computed[i] + pathIndices[i] * (pathElements[i] - computed[i])
        // right = pathElements[i] + pathIndices[i] * (computed[i] - pathElements[i])

        signal left_diff;
        signal right_diff;
        signal left;
        signal right;

        left_diff <== pathElements[i] - computed[i];
        left <== computed[i] + pathIndices[i] * left_diff;

        right_diff <== computed[i] - pathElements[i];
        right <== pathElements[i] + pathIndices[i] * right_diff;

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== left;
        hashers[i].inputs[1] <== right;

        computed[i + 1] <== hashers[i].out;
    }

    // Final computed root must match the expected root
    computed[depth] === root;
}

// ============================================================================
// MAIN TEMPLATE: Whistleblower
// Combines all sub-circuits into a single proof:
//   1. SubstringMatcher — proves phrase exists in chunk
//   2. PoseidonChunkHasher — hashes the chunk uniquely
//   3. MerkleTreeChecker — proves chunk is part of the document
//   4. EdDSAPoseidonVerifier — proves document was signed by Company-X
//
// Parameters:
//   N = chunk size in bytes (default: 64)
//   M = phrase length in bytes (default: 25 for "Confidential: Toxic Waste")
//   DEPTH = Merkle tree depth (default: 10, supports up to 1024 chunks)
//   ENABLE_EDDSA = 1 to include signature verification, 0 to skip
// ============================================================================
template Whistleblower(N, M, DEPTH, ENABLE_EDDSA) {

    // ===================== PUBLIC INPUTS =====================
    signal input root;                  // Merkle root of the document
    signal input targetPhrase[M];       // The phrase to search for (ASCII bytes)

    // ===================== PRIVATE INPUTS ====================
    signal input documentChunk[N];      // The chunk containing the phrase
    signal input pathElements[DEPTH];   // Merkle sibling hashes
    signal input pathIndices[DEPTH];    // Merkle path direction (0=left, 1=right)

    // --- EdDSA signature inputs (only used when ENABLE_EDDSA = 1) ---
    signal input Ax;                    // Signer public key x-coordinate
    signal input Ay;                    // Signer public key y-coordinate
    signal input R8x;                   // Signature R component x
    signal input R8y;                   // Signature R component y
    signal input S;                     // Signature S component

    // ===================== PUBLIC OUTPUTS =====================
    signal output chunkHashOut;         // Hash of the proven chunk (for transparency)

    // =========================================================
    // STEP 1: Prove the target phrase exists within the chunk
    // =========================================================
    component matcher = SubstringMatcher(N, M);
    for (var i = 0; i < N; i++) {
        matcher.chunk[i] <== documentChunk[i];
    }
    for (var i = 0; i < M; i++) {
        matcher.phrase[i] <== targetPhrase[i];
    }
    matcher.found === 1;    // Hard constraint: phrase MUST be found

    // =========================================================
    // STEP 2: Hash the full chunk using cascaded Poseidon
    // =========================================================
    component chunk_hasher = PoseidonChunkHasher(N);
    for (var i = 0; i < N; i++) {
        chunk_hasher.bytes[i] <== documentChunk[i];
    }
    chunkHashOut <== chunk_hasher.out;

    // =========================================================
    // STEP 3: Verify the chunk is in the document's Merkle tree
    // =========================================================
    component merkle = MerkleTreeChecker(DEPTH);
    merkle.leaf <== chunk_hasher.out;
    merkle.root <== root;
    for (var i = 0; i < DEPTH; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i] <== pathIndices[i];
    }

    // =========================================================
    // STEP 4: (Optional) Verify EdDSA signature over the root
    // =========================================================
    if (ENABLE_EDDSA == 1) {
        component sig_verifier = EdDSAPoseidonVerifier();
        sig_verifier.enabled <== 1;
        sig_verifier.Ax <== Ax;
        sig_verifier.Ay <== Ay;
        sig_verifier.R8x <== R8x;
        sig_verifier.R8y <== R8y;
        sig_verifier.S <== S;
        sig_verifier.M <== root;   // The message signed is the Merkle root
    }
}

// ============================================================================
// INSTANTIATION
// N=64 bytes per chunk, M=25 bytes for "Confidential: Toxic Waste"
// DEPTH=10 supports up to 1024 chunks (~64KB file)
// ENABLE_EDDSA=0 for demo mode (set to 1 for full signature verification)
// ============================================================================
component main {public [root, targetPhrase]} = Whistleblower(64, 25, 10, 0);
