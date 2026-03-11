# Performance & Scalability Analysis

## Privacy-Preserving Whistleblower System — Circuit Performance

**Authors:** Abhilash Purohit, Suchet Kumbar, Pratik Anand  
**Date:** March 2026

---

## 1. Circuit Constraint Breakdown

The circuit's total constraint count is determined by its sub-components:

| Component | Parameters | Estimated Constraints |
|-----------|-----------|----------------------|
| **SubstringMatcher** | N=64, M=25 → 40 windows × 25 chars | ~2,000 (IsEqual comparators) |
| **PoseidonChunkHasher** | 4 blocks of 16 + 1 final Poseidon(4) | ~1,200 (5 Poseidon calls) |
| **MerkleTreeChecker** | Depth=10, Poseidon(2) per level | ~2,400 (10 Poseidon calls + mux) |
| **EdDSAPoseidonVerifier** | (when ENABLE_EDDSA=1) | ~5,000–10,000 |
| **Total (demo mode)** | ENABLE_EDDSA=0 | **~5,600** |
| **Total (full mode)** | ENABLE_EDDSA=1 | **~10,600–15,600** |

> **Note:** Each `Poseidon(n)` call costs ~240 constraints. Each `IsEqual()` costs ~3 constraints. Each `GreaterThan(n)` costs ~2n constraints.

---

## 2. Performance Estimates by File Size

The circuit itself has **constant size** — it always processes one 64-byte chunk. What changes with file size is:
- Number of chunks (affects **off-circuit** Merkle tree construction)
- Merkle tree depth (affects **in-circuit** path verification)

| File Size | Chunks (64B) | Merkle Depth | Constraints (Demo) | Constraints (Full) | Est. Prove Time | Est. Verify Time |
|-----------|-------------|-------------|-------------------|-------------------|----------------|-----------------|
| **64 B** | 1 | 1 | ~3,400 | ~8,400–13,400 | ~2s | <100ms |
| **1 KB** | 16 | 4 | ~4,000 | ~9,000–14,000 | ~3s | <100ms |
| **10 KB** | 160 | 8 | ~5,000 | ~10,000–15,000 | ~5s | <100ms |
| **64 KB** | 1,024 | 10 | ~5,600 | ~10,600–15,600 | ~8s | <100ms |
| **100 KB** | 1,600 | 11 | ~5,800 | ~10,800–15,800 | ~10s | <100ms |
| **1 MB** | 16,384 | 14 | ~6,400 | ~11,400–16,400 | ~15s | <100ms |

**Key insight:** Proving time scales with Merkle depth (logarithmic), not file size (linear). A 1 MB file only adds ~3 Poseidon calls vs. a 1 KB file.

---

## 3. Proof Size & Verification Cost

| Metric | Groth16 Value | Notes |
|--------|--------------|-------|
| **Proof size** | ~192 bytes (3 group elements) | Constant regardless of circuit size |
| **Public signals** | ~26 field elements (~832 bytes) | root + 25 phrase chars + chunkHash |
| **Verification time** | < 10ms (Node.js) | 1 pairing check + ~26 scalar multiplications |
| **On-chain gas (Solidity)** | ~220,000 gas (~$0.50 at 30 gwei) | Fixed cost per verification |

---

## 4. Proving System Comparison

| System | Setup | Proof Size | Prove Time* | Verify Time | Recursion |
|--------|-------|-----------|------------|------------|-----------|
| **Groth16** (our choice) | Per-circuit trusted setup | **192 B** ⭐ | ~5s | <10ms ⭐ | No |
| **PLONK** | Universal setup (reusable) | ~400 B | ~8s | ~15ms | Possible |
| **Halo2** | **No trusted setup** ⭐ | ~5–10 KB | ~10s | ~30ms | Yes ⭐ |
| **STARKs** | No setup | ~50–200 KB | ~15s | ~50ms | Yes |

*\*Estimates for ~10K constraint circuit on modern laptop (M1/i7)*

### Why We Chose Groth16
1. **Smallest proof size** — 192 bytes, ideal for on-chain verification
2. **Fastest verification** — single pairing check
3. **Most mature tooling** — circom, snarkjs, circomlib
4. **Lowest on-chain gas** — cheapest Solidity verification
5. **Trade-off accepted:** Per-circuit trusted setup is acceptable for a demo

---

## 5. Optimization Strategies

### 5.1 Reduce Circuit Size
- **Smaller chunk size:** 32 bytes instead of 64 → fewer IsEqual calls, but phrase (25 chars) must still fit
- **Shorter phrase:** Reducing M directly reduces SubstringMatcher constraints
- **Shallower Merkle tree:** Depth 5 instead of 10 → fewer Poseidon calls, but supports fewer chunks

### 5.2 Improve Proving Speed
- **GPU acceleration:** snarkjs supports GPU proving via WASM SIMD (2-3x speedup)
- **Parallel witness computation:** Split witness generation across Web Workers
- **Pre-compute zkey loading:** Load the zkey into memory ahead of time

### 5.3 Scale to Large Files
- **Batched proofs:** Generate proofs for multiple chunks in parallel, aggregate them
- **Recursive proofs (Halo2/Nova):** Prove "I have N valid chunk proofs" in a single proof
- **Larger chunk sizes:** 128 or 256 bytes to reduce the number of chunks needed

### 5.4 Reduce On-Chain Cost
- **Proof aggregation:** Use SnarkPack to aggregate multiple Groth16 proofs into one
- **Layer 2 verification:** Deploy the verifier on Polygon/Arbitrum for ~100x lower gas

---

## 6. Powers of Tau (PTAU) Requirements

| Max Constraints | PTAU File | Size |
|----------------|-----------|------|
| 2^12 = 4,096 | pot12 | ~4 MB |
| 2^14 = 16,384 | pot14 | ~32 MB |
| **2^15 = 32,768** | **pot15** ⭐ | **~64 MB** |
| 2^18 = 262,144 | pot18 | ~512 MB |

Our circuit needs **pot15** (sufficient for up to 32K constraints, covering both demo and full mode).
