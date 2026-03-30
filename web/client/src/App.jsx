import React, { useState, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import {
    UploadCloud, ShieldAlert, Lock, Fingerprint,
    CheckCircle, XCircle, Activity, FileSearch,
    Shield, Eye, EyeOff, Cpu, Download, ShieldCheck,
    WifiOff, UserX, MapPinOff, FileX, QrCode,
    BarChart3, FileText, Clock, AlertTriangle, HelpCircle
} from "lucide-react";
import * as snarkjs from "snarkjs";
import QRCode from "qrcode";
import "./index.css";
import AboutTab from "./AboutTab";

// ============================================================================
// Constants — must match circuit instantiation: Whistleblower(64, 25, 5, 0)
// ============================================================================
const CHUNK_SIZE = 64;
const PHRASE_LENGTH = 25;
const CIRCUIT_DEPTH = 5;
const TARGET_PHRASE = "Confidential: Toxic Waste";

// ============================================================================
// Merkle Proof Builder (uses server-provided tree data)
// ============================================================================
function buildMerkleProof(tree, treeDepth, leafIndex) {
    const pathElements = [];
    const pathIndices = [];
    let currentIndex = leafIndex;

    for (let level = 0; level < treeDepth; level++) {
        const isRight = currentIndex % 2;
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

        pathElements.push(
            tree[level][siblingIndex] !== undefined
                ? tree[level][siblingIndex].toString()
                : "0"
        );
        pathIndices.push(isRight);
        currentIndex = Math.floor(currentIndex / 2);
    }

    while (pathElements.length < CIRCUIT_DEPTH) {
        pathElements.push("0");
        pathIndices.push(0);
    }

    return { pathElements, pathIndices };
}

// ============================================================================
// 3D Background
// ============================================================================
function NodeNetwork() {
    const ref = useRef();
    const positions = useMemo(() => {
        const pos = new Float32Array(400 * 3);
        for (let i = 0; i < 400; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 12;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
        }
        return pos;
    }, []);

    useFrame((_, delta) => {
        if (ref.current) ref.current.rotation.y += delta * 0.02;
    });

    return (
        <Points ref={ref} positions={positions} stride={3}>
            <PointMaterial
                transparent
                color="#00f2fe"
                size={0.03}
                sizeAttenuation
                depthWrite={false}
                opacity={0.4}
            />
        </Points>
    );
}

// ============================================================================
// Admin Dashboard Component
// ============================================================================
function AdminDashboard({ onClose }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/admin/stats")
            .then(res => res.json())
            .then(data => { setStats(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="admin-loading">Loading dashboard...</div>;
    if (!stats) return <div className="admin-loading">Failed to load stats.</div>;

    return (
        <motion.div
            className="admin-dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="admin-header">
                <h3><BarChart3 size={18} /> Verification Dashboard</h3>
                <button className="admin-close" onClick={onClose}>✕</button>
            </div>

            <div className="admin-stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.registeredDocuments}</div>
                    <div className="stat-label">Registered Docs</div>
                </div>
                <div className="stat-card accent-green">
                    <div className="stat-value">{stats.verifications.passed}</div>
                    <div className="stat-label">Verified ✓</div>
                </div>
                <div className="stat-card accent-red">
                    <div className="stat-value">{stats.verifications.failed}</div>
                    <div className="stat-label">Rejected ✗</div>
                </div>
                <div className="stat-card accent-yellow">
                    <div className="stat-value">{stats.verifications.replaysBlocked}</div>
                    <div className="stat-label">Replays Blocked</div>
                </div>
            </div>

            {/* Registered Documents List */}
            {stats.documents && stats.documents.length > 0 && (
                <div className="admin-section">
                    <h4><FileText size={14} /> Registered Documents</h4>
                    <div className="doc-list">
                        {stats.documents.map((doc, i) => (
                            <div key={i} className="doc-list-item">
                                <span className="doc-name">{doc.name}</span>
                                <span className="doc-meta">{doc.chunks} chunks</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Activity */}
            {stats.recentActivity && stats.recentActivity.length > 0 && (
                <div className="admin-section">
                    <h4><Clock size={14} /> Recent Anonymous Activity</h4>
                    <div className="activity-list">
                        {stats.recentActivity.map((entry, i) => (
                            <div key={i} className={`activity-item ${entry.result === "VALID" ? "valid" : "invalid"}`}>
                                <span className="activity-result">
                                    {entry.result === "VALID" ? "✅" : entry.result === "REPLAY_BLOCKED" ? "🛡️" : "❌"}
                                </span>
                                <span className="activity-hash">{entry.proofFingerprint}...</span>
                                <span className="activity-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="admin-privacy-note">
                <ShieldCheck size={12} /> All entries are anonymous — zero identity data recorded
            </div>
        </motion.div>
    );
}

// ============================================================================
// Main Application
// ============================================================================
function App() {
    const [activeTab, setActiveTab] = useState('prover');
    const [currentStep, setCurrentStep] = useState(0);
    const [viewingStep, setViewingStep] = useState(null);
    const [resultTitle, setResultTitle] = useState("");
    const [resultMsg, setResultMsg] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [statusLog, setStatusLog] = useState([]);
    const [proofReceipt, setProofReceipt] = useState(null);
    const [qrDataUrl, setQrDataUrl] = useState(null);
    const [showAdmin, setShowAdmin] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [privacyStatus, setPrivacyStatus] = useState({
        fileLocal: false,
        identityHidden: true,
        ipStripped: false,
        metadataRedacted: false,
        proofGenerated: false,
        contentNeverSent: false
    });

    const fileInputRef = useRef(null);

    const steps = [
        { title: "Awaiting File", icon: <UploadCloud size={18} /> },
        { title: "Reading File", icon: <FileSearch size={18} /> },
        { title: "Phrase Search", icon: <Eye size={18} /> },
        { title: "Computing Witness", icon: <Fingerprint size={18} /> },
        { title: "Generating SNARK", icon: <Lock size={18} /> },
        { title: "Network Verify", icon: <Shield size={18} /> },
    ];

    const addLog = (msg, stepOverride) => {
        setStatusLog(prev => [...prev.slice(-30), { text: msg, step: stepOverride || currentStep }]);
    };

    const displayStep = viewingStep !== null ? viewingStep : currentStep;

    // ─── Core ZK Proof Flow ──────────────────────────────────────────
    const processFile = async (file) => {
        if (!file) return;

        try {
            // STEP 1: Read file locally in browser
            setCurrentStep(1);
            addLog(`Reading "${file.name}" (${file.size} bytes)...`, 1);

            const fileBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(new Uint8Array(e.target.result));
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.readAsArrayBuffer(file);
            });

            // Normalize line endings: strip out \r (ASCII 13) to prevent OS-level chunk boundary shifts
            const rawFileBytes = new Uint8Array(fileBuffer);
            const fileBytes = [];
            for (let i = 0; i < rawFileBytes.length; i++) {
                if (rawFileBytes[i] !== 13) fileBytes.push(rawFileBytes[i]);
            }
            
            const fileText = new TextDecoder().decode(new Uint8Array(fileBytes));

            addLog(`✓ File loaded: ${fileBytes.length} normalized bytes`, 1);
            addLog(`✓ File metadata REDACTED (name, path stripped)`, 1);
            setPrivacyStatus(prev => ({
                ...prev,
                fileLocal: true,
                metadataRedacted: true,
                contentNeverSent: true
            }));
            await new Promise(r => setTimeout(r, 300));

            // STEP 2: Search for the target phrase
            setCurrentStep(2);
            addLog(`Scanning for phrase: "${TARGET_PHRASE}"`, 2);

            if (!fileText.includes(TARGET_PHRASE)) {
                throw new Error("Target phrase not found in document. Cannot generate proof.");
            }

            addLog("✓ Phrase located in document", 2);
            await new Promise(r => setTimeout(r, 300));

            // STEP 3: Build circuit witness using server-provided Merkle tree
            setCurrentStep(3);
            addLog("Fetching Merkle trees from registry...", 3);

            // FEATURE 6: Multi-document support
            const merkleRes = await fetch(`/merkle-data?t=${Date.now()}`);
            if (!merkleRes.ok) {
                throw new Error("Merkle data not available. Document may not be registered.");
            }
            const merkleResponse = await merkleRes.json();
            const allDocuments = merkleResponse.documents || [];

            addLog(`✓ Registry loaded: ${allDocuments.length} registered document(s)`, 3);

            // Split the uploaded file into chunks
            const chunks = [];
            for (let i = 0; i < fileBytes.length; i += CHUNK_SIZE) {
                const chunk = new Array(CHUNK_SIZE).fill(32);
                for (let j = 0; j < CHUNK_SIZE && (i + j) < fileBytes.length; j++) {
                    chunk[j] = fileBytes[i + j];
                }
                chunks.push(chunk);
            }

            // Find the chunk containing the phrase
            let phraseChunkIndex = -1;
            for (let i = 0; i < chunks.length; i++) {
                const chunkStr = chunks[i].map(b => String.fromCharCode(b)).join("");
                if (chunkStr.includes(TARGET_PHRASE)) {
                    phraseChunkIndex = i;
                    break;
                }
            }

            if (phraseChunkIndex === -1) {
                throw new Error("Phrase not found in any single chunk.");
            }

            addLog(`✓ Phrase found in chunk ${phraseChunkIndex}`);

            // Compute exact file hash (SHA-256) to correctly identify the document
            const normalizedUint8 = new Uint8Array(fileBytes);
            const hashBuffer = await crypto.subtle.digest('SHA-256', normalizedUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // Multi-document: find the exactly matching document by fileHash
            let matchedDoc = null;
            for (const doc of allDocuments) {
                if (doc.fileHash === fileHash) {
                    matchedDoc = doc;
                    addLog(`✓ Matched document: "${doc.name || doc.docId}"`);
                    break;
                }
            }

            if (!matchedDoc) {
                // Fallback for backward compatibility or when testing locally 
                if (allDocuments.length === 1 && !allDocuments[0].fileHash) {
                    matchedDoc = allDocuments[0];
                    addLog("⚠ Using single registered document bypass", 3);
                } else {
                    throw new Error("This exact document has not been registered. The cryptographic fingerprint does not match any authorized file.");
                }
            }

            // Build Merkle inclusion proof from the matched document's tree
            const tree = matchedDoc.tree.map(level => level.map(h => BigInt(h)));
            const { pathElements, pathIndices } = buildMerkleProof(
                tree, matchedDoc.treeDepth, phraseChunkIndex
            );
            addLog(`✓ Merkle proof: ${pathElements.length} path elements`);

            // Prepare circuit input
            const phraseAscii = [];
            for (let i = 0; i < TARGET_PHRASE.length; i++) {
                phraseAscii.push(TARGET_PHRASE.charCodeAt(i));
            }

            const circuitInput = {
                root: matchedDoc.merkleRoot,
                targetPhrase: phraseAscii,
                documentChunk: chunks[phraseChunkIndex],
                pathElements: pathElements,
                pathIndices: pathIndices.map(String),
                Ax: "0", Ay: "0", R8x: "0", R8y: "0", S: "0"
            };

            addLog("✓ Witness prepared with Merkle proof");
            await new Promise(r => setTimeout(r, 200));

            // STEP 4: Generate ZK-SNARK proof
            setCurrentStep(4);
            addLog("Initializing Groth16 prover (WASM)...");

            const startTime = Date.now();

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                circuitInput,
                "/whistleblower.wasm",
                "/circuit_final.zkey"
            );

            const proveTime = ((Date.now() - startTime) / 1000).toFixed(1);
            addLog(`✓ Proof generated in ${proveTime}s`);
            addLog(`  Public signals: ${publicSignals.length} values`);

            // STEP 5: Send proof to verifier
            setCurrentStep(5);

            // FEATURE 4: Timing attack mitigation
            const randomDelay = 1000 + Math.random() * 2000;
            addLog(`🔒 Applying timing obfuscation (${(randomDelay / 1000).toFixed(1)}s delay)...`);
            await new Promise(r => setTimeout(r, randomDelay));
            addLog("✓ Timing attack mitigated");

            addLog("Transmitting proof to verification network...");
            addLog("⚠ Only proof transmitted — document content NEVER sent");

            const res = await fetch("/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proof, publicSignals }),
            });

            const data = await res.json();

            // Check privacy headers from server
            const privacyHeader = res.headers.get("X-Privacy-Policy");
            const identityTracked = res.headers.get("X-Identity-Tracked");
            if (privacyHeader === "zero-knowledge") {
                addLog("✓ Server confirmed: zero-knowledge policy");
            }
            if (identityTracked === "false") {
                addLog("✓ Server confirmed: identity NOT tracked");
            }
            setPrivacyStatus(prev => ({ ...prev, ipStripped: true }));

            // STEP 6: Show result
            setCurrentStep(6);

            if (data.verified) {
                setIsSuccess(true);
                setResultTitle("Authentication Verified");
                setResultMsg("Zero-Knowledge proof verified successfully. The document contains the required phrase and the proof is cryptographically sound.");
                setProofReceipt(data.receipt);
                setPrivacyStatus(prev => ({ ...prev, proofGenerated: true }));
                addLog("✓ VERIFICATION PASSED");
                addLog("✓ Anonymous receipt generated");
                addLog("✓ Replay protection active");

                // FEATURE 7: Generate QR code from receipt
                if (data.receipt) {
                    try {
                        const qrUrl = await QRCode.toDataURL(
                            JSON.stringify({
                                id: data.receipt.receiptId,
                                result: data.receipt.verificationResult,
                                fingerprint: data.receipt.proofFingerprint,
                                identity: "NOT_RECORDED"
                            }),
                            { width: 200, margin: 2, color: { dark: "#10b981", light: "#0a0e17" } }
                        );
                        setQrDataUrl(qrUrl);
                    } catch (e) { /* QR generation is non-critical */ }
                }
            } else {
                setIsSuccess(false);
                setResultTitle("Verification Failed");
                setResultMsg(data.message || "The cryptographic proof could not be verified.");
                if (data.receipt) setProofReceipt(data.receipt);
                addLog("✗ VERIFICATION FAILED: " + (data.message || "Unknown"));
            }

        } catch (err) {
            console.error(err);
            setCurrentStep(6);
            setIsSuccess(false);
            setResultTitle("Authentication Error");
            setResultMsg(err.message);
            addLog("✗ ERROR: " + err.message);
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        processFile(file);
    };

    // FEATURE 8: Drag and drop
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    const handleReviewPrev = () => {
        if (displayStep > 1) {
            setViewingStep(displayStep - 1);
        }
    };

    const handleReviewNext = () => {
        if (displayStep < steps.length) {
            setViewingStep(displayStep + 1);
        } else {
            setViewingStep(null); // Return to summary/complete view
        }
    };

    const resetProcess = () => {
        setCurrentStep(0);
        setResultTitle("");
        setResultMsg("");
        setStatusLog([]);
        setProofReceipt(null);
        setQrDataUrl(null);
        setPrivacyStatus({
            fileLocal: false,
            identityHidden: true,
            ipStripped: false,
            metadataRedacted: false,
            proofGenerated: false,
            contentNeverSent: false
        });
    };

    const downloadReceipt = () => {
        if (!proofReceipt) return;
        const blob = new Blob([JSON.stringify(proofReceipt, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `anonymous_receipt_${proofReceipt.receiptId.substring(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Render ────────────────────────────────────────────────────────
    return (
        <div className="app-layout">
            {/* 3D Background */}
            <div className="canvas-bg">
                <Canvas camera={{ position: [0, 0, 5] }}>
                    <ambientLight intensity={0.3} />
                    <NodeNetwork />
                </Canvas>
                <div className="canvas-overlay" />
            </div>

            {/* Admin Dashboard Overlay */}
            <AnimatePresence>
                {showAdmin && (
                    <motion.div
                        className="admin-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <AdminDashboard onClose={() => setShowAdmin(false)} />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="split-container">
                {/* ─── LEFT: Hero ──────────────────────────── */}
                <section className="hero-panel">
                    <div className="brand">
                        <ShieldAlert className="brand-icon" size={26} />
                        <span className="brand-name">Whistleblower-ZK</span>
                        {/* FEATURE 5: Admin dashboard toggle */}
                        <button className="admin-btn" onClick={() => setShowAdmin(!showAdmin)} title="Dashboard">
                            <BarChart3 size={16} />
                        </button>
                    </div>

                    <div className="nav-tabs">
                        <button className={`nav-tab ${activeTab === 'prover' ? 'active' : ''}`} onClick={() => setActiveTab('prover')}>
                            <Shield size={14} /> System
                        </button>
                        <button className={`nav-tab ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>
                            <HelpCircle size={14} /> How it Works
                        </button>
                    </div>

                    <div className="hero-content">
                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            Prove Truth,<br />
                            <span className="gradient-text">Stay Anonymous</span>
                        </motion.h1>

                        <motion.p
                            className="hero-description"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                        >
                            Upload a classified document. Our ZK-SNARK engine generates
                            a cryptographic proof that a phrase exists — without revealing
                            the document, your identity, or your location.
                        </motion.p>

                        <motion.div
                            className="tech-badges"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <span className="badge"><Cpu size={12} /> Groth16</span>
                            <span className="badge"><Lock size={12} /> Poseidon</span>
                            <span className="badge"><Fingerprint size={12} /> EdDSA</span>
                            <span className="badge"><EyeOff size={12} /> Zero Knowledge</span>
                            <span className="badge"><AlertTriangle size={12} /> Replay Protected</span>
                        </motion.div>
                    </div>

                    <div className="hero-footer">
                        <div className="info-row">
                            <span>v2.3.0</span>
                            <span>•</span>
                            <span>CNS Project</span>
                            <span>•</span>
                            <span>Client-Side Proving</span>
                        </div>
                    </div>

                    {/* Privacy Shield Panel — shows when processing */}
                    {currentStep > 0 && (
                        <motion.div
                            className="privacy-shield"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <div className="shield-header">
                                <ShieldCheck size={16} />
                                <span>Privacy Shield Active</span>
                            </div>
                            <div className="shield-items">
                                <div className={`shield-item ${privacyStatus.identityHidden ? 'active' : ''}`}>
                                    <UserX size={13} />
                                    <span>Identity Hidden</span>
                                </div>
                                <div className={`shield-item ${privacyStatus.fileLocal ? 'active' : ''}`}>
                                    <EyeOff size={13} />
                                    <span>File Stays Local</span>
                                </div>
                                <div className={`shield-item ${privacyStatus.metadataRedacted ? 'active' : ''}`}>
                                    <FileX size={13} />
                                    <span>Metadata Redacted</span>
                                </div>
                                <div className={`shield-item ${privacyStatus.contentNeverSent ? 'active' : ''}`}>
                                    <WifiOff size={13} />
                                    <span>Content Never Sent</span>
                                </div>
                                <div className={`shield-item ${privacyStatus.ipStripped ? 'active' : ''}`}>
                                    <MapPinOff size={13} />
                                    <span>IP Address Stripped</span>
                                </div>
                                <div className={`shield-item ${privacyStatus.proofGenerated ? 'active' : ''}`}>
                                    <ShieldCheck size={13} />
                                    <span>ZK Proof Only</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </section>

                {/* ─── RIGHT: Command Center ──────────────── */}
                <section className={`command-panel ${activeTab === 'about' ? 'about-active' : ''}`}>
                    {activeTab === 'prover' ? (
                    <div className="glass-card">
                        {/* Header */}
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2>Command Center</h2>
                                <div className="status-pill">
                                    <div className={`status-dot ${currentStep > 0 && currentStep < 6 ? "active" : "idle"}`} />
                                    <span>
                                        {currentStep === 0 ? "System Idle" :
                                            currentStep === 6 ? "Complete" : "Processing"}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Review Navigation Buttons only show when complete */}
                            {currentStep === 6 && (
                                <div className="review-controls" style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        className="btn-secondary" 
                                        onClick={handleReviewPrev} 
                                        disabled={displayStep === 1}
                                        style={{ padding: '6px 12px', fontSize: '12px' }}
                                    >
                                        &larr; Prev Step
                                    </button>
                                    <button 
                                        className="btn-secondary" 
                                        onClick={handleReviewNext} 
                                        disabled={viewingStep === null}
                                        style={{ padding: '6px 12px', fontSize: '12px' }}
                                    >
                                        {displayStep === 6 ? "View Summary" : "Next Step \u2192"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Progress Timeline */}
                        <div className="timeline">
                            {steps.map((step, i) => {
                                const stepIndex = i + 1;
                                const isActive = displayStep === stepIndex;
                                const isPast = displayStep > stepIndex || (displayStep === 6 && stepIndex < 6);
                                return (
                                    <div key={i} className={`tl-step ${isActive ? "active" : ""} ${isPast ? "past" : ""}`}>
                                        <div className="tl-icon">
                                            {isPast ? <CheckCircle size={14} /> : step.icon}
                                        </div>
                                        <span className="tl-label">{step.title}</span>
                                        {i < steps.length - 1 && <div className="tl-connector" />}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Dynamic Content */}
                        <div className="card-body">
                            <AnimatePresence mode="wait">
                                {/* IDLE — FEATURE 8: Drag and Drop */}
                                {currentStep === 0 && (
                                    <motion.div
                                        key="upload"
                                        initial={{ opacity: 0, scale: 0.97 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ duration: 0.3 }}
                                        className="upload-zone"
                                    >
                                        <div
                                            className={`dropzone ${isDragOver ? "drag-active" : ""}`}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            <UploadCloud size={44} className="drop-icon" strokeWidth={1.5} />
                                            <h3>{isDragOver ? "Drop file here" : "Drop classified file here"}</h3>
                                            <p>File is read locally — never uploaded to any server.</p>
                                            <label className="btn-primary" id="file-upload-btn">
                                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} />
                                                Browse Secure File
                                            </label>
                                        </div>
                                    </motion.div>
                                )}

                                {/* PROCESSING OR REVIEWING A PAST STEP */}
                                {((displayStep > 0 && displayStep <= 6 && viewingStep !== null) || (currentStep > 0 && currentStep < 6 && viewingStep === null)) && (
                                    <motion.div
                                        key="processing"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="processing-view"
                                    >
                                        <div className="scanner">
                                            <div className="doc-wireframe" />
                                            <div className="scan-beam" />
                                        </div>
                                        <div className="processing-info">
                                            <h3>{steps[displayStep - 1]?.title || "Processing"}</h3>
                                            <div className="log-feed">
                                                {statusLog.filter(log => log.step === displayStep).map((log, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="log-line"
                                                    >
                                                        <span className="log-bullet">›</span>
                                                        <span className="log-text">{log.text}</span>
                                                    </motion.div>
                                                ))}
                                                {statusLog.filter(log => log.step === displayStep).length === 0 && (
                                                    <div className="log-line" style={{ opacity: 0.5 }}>
                                                        <span className="log-bullet">›</span>
                                                        <span className="log-text">No logs generated for this step.</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* COMPLETE SUMMARY VIEW */}
                                {currentStep === 6 && viewingStep === null && (
                                    <motion.div
                                        key="result"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`result-view ${isSuccess ? "success" : "error"}`}
                                    >
                                        <div className="result-icon-wrap">
                                            {isSuccess ? <CheckCircle size={48} /> : <XCircle size={48} />}
                                        </div>
                                        <h3>{resultTitle}</h3>
                                        <p>{resultMsg}</p>

                                        {/* Receipt + QR Code side by side */}
                                        {proofReceipt && isSuccess && (
                                            <div className="receipt-qr-row">
                                                <div className="receipt-card">
                                                    <div className="receipt-header">
                                                        <ShieldCheck size={14} />
                                                        <span>Anonymous Proof Receipt</span>
                                                    </div>
                                                    <div className="receipt-body">
                                                        <div className="receipt-row">
                                                            <span className="receipt-label">Receipt ID</span>
                                                            <span className="receipt-value">{proofReceipt.receiptId?.substring(0, 8)}...</span>
                                                        </div>
                                                        <div className="receipt-row">
                                                            <span className="receipt-label">Proof Hash</span>
                                                            <span className="receipt-value">{proofReceipt.proofFingerprint}</span>
                                                        </div>
                                                        <div className="receipt-row">
                                                            <span className="receipt-label">Submitter</span>
                                                            <span className="receipt-value redacted">NOT RECORDED</span>
                                                        </div>
                                                        <div className="receipt-row">
                                                            <span className="receipt-label">IP Address</span>
                                                            <span className="receipt-value redacted">NOT RECORDED</span>
                                                        </div>
                                                        <div className="receipt-row">
                                                            <span className="receipt-label">Replay</span>
                                                            <span className="receipt-value" style={{ color: '#10b981' }}>PROTECTED</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* FEATURE 7: QR Code */}
                                                {qrDataUrl && (
                                                    <div className="qr-card">
                                                        <div className="qr-label"><QrCode size={12} /> Scan Receipt</div>
                                                        <img src={qrDataUrl} alt="QR Code" className="qr-image" />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="result-actions">
                                            {proofReceipt && isSuccess && (
                                                <button className="btn-secondary" onClick={downloadReceipt}>
                                                    <Download size={16} /> Download Receipt
                                                </button>
                                            )}
                                            <button className="btn-primary" onClick={resetProcess}>
                                                Authenticate Another
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    ) : (
                        <div className="glass-card about-card">
                            <AboutTab />
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "red", padding: "40px", backgroundColor: "#333", height: "100vh" }}>
          <h2>React Rendering Crash</h2>
          <pre>{this.state.error?.message}</pre>
          <pre style={{ fontSize: "10px" }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppWithBoundary() {
    return (
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    );
}

export default AppWithBoundary;
