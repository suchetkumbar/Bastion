# Real-World Adaptation Notes

## From Demo to Production — Bridging the Gap

**Authors:** Abhilash Purohit, Suchet Kumbar, Pratik Anand  
**Date:** March 2026

---

## 1. ECDSA / RSA → ZK-Friendly Signature Bridge

Real companies use ECDSA (secp256k1, P-256) or RSA-2048 for digital signatures. These are **not feasible** to verify inside a ZK circuit due to their enormous constraint cost (~500K–1.5M constraints for ECDSA).

### Pattern 1: Attestation Bridge (Recommended)

```
┌─────────────┐     ECDSA sign      ┌──────────────────┐
│  Company-X   │ ──────────────────→ │ Document + Cert  │
│  PKI (RSA)   │                     └──────┬───────────┘
└──────────────┘                            │
                                            ▼
                                   ┌──────────────────┐
                                   │ Attestation Bridge │
                                   │ (Trusted Service)  │
                                   └──────┬───────────┘
                                            │ Verify ECDSA, then
                                            │ re-sign with EdDSA
                                            ▼
                              ┌─────────────────────────┐
                              │ EdDSA-signed Merkle Root │
                              │  (ZK-friendly)           │
                              └─────────────────────────┘
```

**How it works:**
1. Company-X signs documents with their standard ECDSA certificate
2. A trusted bridge service receives the signed document
3. The bridge verifies the ECDSA signature using standard crypto
4. If valid, the bridge computes the Poseidon Merkle root and signs it with EdDSA (Baby Jubjub)
5. The whistleblower uses the EdDSA signature in the ZK circuit

**Trust assumption:** The bridge must be trusted to not forge EdDSA signatures for unauthorized documents. Can be mitigated with multiple independent bridges (threshold agreement).

### Pattern 2: BLS Threshold Signing

```
┌────────┐  ┌────────┐  ┌────────┐
│ Node 1 │  │ Node 2 │  │ Node 3 │   (t-of-n threshold)
└───┬────┘  └───┬────┘  └───┬────┘
    │           │           │
    └───────────┼───────────┘
                │
    ┌───────────▼───────────┐
    │  Aggregate BLS Sig    │
    │  (ZK-efficient)       │
    └───────────────────────┘
```

**How it works:**
1. Multiple independent parties each verify the ECDSA-signed document
2. Each party produces a partial BLS signature share
3. Shares are aggregated into one BLS signature
4. BLS verification is more ZK-efficient than ECDSA (~50K constraints vs ~500K)

**Trade-off:** Requires a distributed network of verifiers. More complex infrastructure but better trust model than a single bridge.

### Pattern 3: On-Chain Document Registry

```
┌─────────────┐   publish root   ┌────────────────────┐
│  Company-X   │ ──────────────→ │ Ethereum Smart     │
│  (via MetaMask)│                │ Contract Registry  │
└──────────────┘                 └────────┬───────────┘
                                          │
                           ┌──────────────▼──────────────┐
                           │ Whistleblower generates      │
                           │ ZK proof that root is in     │
                           │ contract storage (state proof)│
                           └─────────────────────────────┘
```

**How it works:**
1. Company-X publishes the Merkle root to a smart contract using their Ethereum address
2. The whistleblower proves (via a state proof) that the root exists in the contract
3. The smart contract address is the company's attestation — no separate signature needed

**Trade-off:** Requires Company-X to interact with blockchain. Document publication is public (the root, not content).

---

## 2. Anonymization Strategies

### 2.1 Tor Integration

The simplest path to network anonymity:

```
Whistleblower → Tor Circuit (3+ relays) → Verifier Server
```

**Implementation:**
- Use the `tor` system service or Tor Browser
- Set the proof submission endpoint to be accessible as a `.onion` service
- Configure the Express backend as a Tor hidden service

```bash
# Install Tor on WSL2
sudo apt install tor
# Configure hidden service in /etc/tor/torrc:
# HiddenServiceDir /var/lib/tor/whistleblower/
# HiddenServicePort 4000 127.0.0.1:4000
```

### 2.2 Relay Network

For cases where Tor is blocked:

```
Whistleblower → Relay 1 → Relay 2 → Verifier
```

Each relay strips identifying metadata and forwards only the proof JSON.

### 2.3 Smart Contract Submission

The most robust approach:

```
Whistleblower → ZK Proof → Ethereum Transaction → On-chain Verifier
```

- The transaction itself can be submitted via a relayer (e.g., OpenGSN) to avoid gas costs
- Blockchain provides pseudonymity (address != identity)
- Proof is permanently and publicly verifiable on-chain

### 2.4 Backend Privacy Hardening

Regardless of the network path, the server should:

```javascript
// Do NOT log IP addresses
app.set('trust proxy', false);

// Disable request logging
// Do NOT use morgan or similar request loggers

// Strip all headers that reveal client info
app.use((req, res, next) => {
  delete req.headers['x-forwarded-for'];
  delete req.headers['x-real-ip'];
  next();
});

// Set appropriate security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
```

---

## 3. Production Architecture (Recommended)

```
┌──────────────────────────────────────────────────────────┐
│                      PRODUCTION STACK                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Company-X Side:                                         │
│  ┌─────────────┐    ┌──────────────────┐                │
│  │ Document DB  │───→│ Attestation Key  │                │
│  │ (Internal)   │    │ (EdDSA + ECDSA)  │                │
│  └──────────────┘    └────────┬─────────┘                │
│                               │ Publish EdDSA-signed     │
│                               │ Merkle roots to chain    │
│                               ▼                          │
│  ┌────────────────────────────────────────┐              │
│  │ Ethereum Smart Contract                │              │
│  │ - Document Registry (roots)            │              │
│  │ - Groth16 Verifier (auto-generated)    │              │
│  └────────────────────────────────────────┘              │
│                               ▲                          │
│  Whistleblower Side:          │ Submit proof via Tor     │
│  ┌──────────────┐    ┌──────┴──────┐                    │
│  │ Browser WASM │───→│ Relayer /   │                    │
│  │ Proof Engine  │    │ Tor Network │                    │
│  └──────────────┘    └─────────────┘                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Key properties:**
1. **No trusted server** — Verification is on-chain
2. **No identity leaks** — Tor + relayer
3. **Immutable proofs** — Blockchain provides tamper-proof records
4. **Self-contained proofs** — EdDSA in circuit means no separate registry check needed
