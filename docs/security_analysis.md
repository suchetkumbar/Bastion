# Security & Privacy Analysis

## Privacy-Preserving Whistleblower System — Threat Model & Analysis

**Authors:** Abhilash Purohit, Suchet Kumbar, Pratik Anand  
**Date:** March 2026

---

## 1. What is Revealed by Public Signals

The ZK proof exposes **only** these values to the verifier:

| Public Signal | Value | Risk Level |
|---------------|-------|------------|
| `root` | Merkle root of the full document | **Low** — reveals document identity but not content |
| `targetPhrase[0..24]` | ASCII bytes of "Confidential: Toxic Waste" | **None** — this is the claim being proven, known to all parties |
| `chunkHashOut` | Poseidon hash of the proven chunk | **Very Low** — computationally infeasible to reverse |

### What is NOT revealed:
- ❌ The document's actual text content
- ❌ Which chunk contains the phrase (only the chunk hash, not its index)
- ❌ The whistleblower's identity or IP address
- ❌ Any other chunks or their hashes
- ❌ The Merkle path (sibling hashes)
- ❌ The Company-X signature components (R8, S — these are private inputs)

---

## 2. Attack Surface Analysis

### 2.1 File Re-Use Attack
**Threat:** An adversary who has access to the same document can verify which document was leaked by computing the Merkle root and comparing it to the public `root` signal.

**Mitigation:** This is **by design** — the root proves document authenticity. If document identity must also be hidden, use a commitment scheme where the root is replaced by `Poseidon(root, nonce)` with a secret nonce.

### 2.2 Metadata Leaks

| Metadata | Leaks? | Mitigation |
|----------|--------|------------|
| **File size** | ⚠️ Partially — can be inferred from Merkle tree depth | Use a fixed large tree depth regardless of file size |
| **Chunk boundaries** | ⚠️ The fixed 64-byte chunking reveals approximate phrase location if file is known | Randomize chunk offset with a secret shift |
| **Timing** | ⚠️ Proving time correlates with circuit complexity | Use constant-time proving (pad to maximum circuit size) |
| **IP address** | ✅ No — server doesn't see the document | Use Tor or a relay network for submission |

### 2.3 Deanonymization Risks

1. **Network-level:** The whistleblower's IP is visible to the verifier server when submitting the proof. **Mitigation:** Submit via Tor, VPN, or an anonymous relay.

2. **Proof timing:** If only one person had access to the document, the timing of proof submission may correlate with their access logs. **Mitigation:** Introduce random delay before submission.

3. **Browser fingerprinting:** WebAssembly proving in the browser can be fingerprinted via timing side-channels. **Mitigation:** Use a clean browser profile or generate the proof offline via CLI scripts.

4. **Device forensics:** The browser may cache the WASM module, zkey file, or download history. **Mitigation:** Use private/incognito browsing mode. The CLI scripts leave no browser traces.

### 2.4 Cryptographic Attack Vectors

| Attack | Feasibility | Notes |
|--------|-------------|-------|
| **Forge a proof** | ❌ Infeasible | Groth16 is computationally sound under Knowledge-of-Exponent assumption |
| **Extract witness from proof** | ❌ Infeasible | Zero-knowledge property of Groth16 |
| **Brute-force chunk from hash** | ❌ Infeasible | Poseidon has 128-bit security over BN128 |
| **Trusted setup compromise** | ⚠️ Theoretical risk | If the toxic waste from the ceremony is recovered, fake proofs can be generated. **Mitigation:** Multi-party ceremony (MPC) |
| **Replay attack** | ⚠️ Low risk | A valid proof can be re-submitted. **Mitigation:** Add a nonce or timestamp to public inputs |

---

## 3. Limitations of Standard Certificate Verification

### Why ECDSA/RSA Can't Be Verified Directly in ZK

Real corporate certificates use ECDSA (secp256k1) or RSA-2048 signatures. Verifying these inside a ZK circuit is **extremely expensive**:

| Signature | Constraints in Circom | Practicality |
|-----------|----------------------|--------------|
| EdDSA (Baby Jubjub) | ~5,000 | ✅ Practical |
| ECDSA (secp256k1) | ~500,000–1,500,000 | ❌ Impractical for browser proving |
| RSA-2048 | ~1,000,000+ | ❌ Impractical |

### Practical Workarounds

1. **Attestation Bridge:** The company publishes a ZK-friendly key (EdDSA on Baby Jubjub) alongside their standard PKI. They sign the same documents with both keys. The ZK circuit verifies only the EdDSA signature.

2. **Notary Service:** A trusted notary receives the ECDSA-signed document, verifies the standard signature, and re-signs the Merkle root using EdDSA. The notary is trusted to not forge attestations but does not learn the document content.

3. **On-chain Attestation:** The company publishes the Merkle root of each document to a smart contract using their Ethereum key. The ZK circuit verifies that the root exists in the contract's state (via a storage proof).

---

## 4. Privacy Guarantees Summary

| Property | Guaranteed? | Mechanism |
|----------|------------|-----------|
| **Document privacy** | ✅ Yes | Document is never sent to the server; only the proof is transmitted |
| **Content confidentiality** | ✅ Yes | The chunk is a private witness; only its Poseidon hash is revealed |
| **Whistleblower anonymity** | ⚠️ Partial | Network-level anonymity requires Tor/VPN; the ZK proof itself reveals nothing about the prover |
| **Document authenticity** | ✅ Yes (demo) | EdDSA signature verification proves Company-X signed the root |
| **Proof non-forgeability** | ✅ Yes | Groth16 computational soundness; proofs cannot be faked without the private witness |
| **Verifier privacy** | ✅ Yes | The verifier learns nothing beyond what's in the public signals |

---

## 5. Recommendations for Production Deployment

1. **Use a multi-party computation (MPC) ceremony** for the Groth16 trusted setup to eliminate single points of trust.
2. **Deploy the verifier as a smart contract** on Ethereum/Polygon to eliminate the trusted server.
3. **Integrate Tor** for proof submission to protect the whistleblower's IP address.
4. **Add a nonce/timestamp** to the circuit's public inputs to prevent proof replay attacks.
5. **Consider PLONK or Halo2** for production — they eliminate the per-circuit trusted setup requirement.
6. **Audit the circuit** using formal verification tools (e.g., Ecne, Picus) before deployment.
