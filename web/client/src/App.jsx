import React, { useState, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import {
    UploadCloud, ShieldAlert, Lock, Fingerprint,
    CheckCircle, XCircle, Activity, FileSearch,
    Shield, Eye, EyeOff, Cpu
} from "lucide-react";
import * as snarkjs from "snarkjs";
import "./index.css";

// ============================================================================
// 3D Animated Background — Floating Node Network
// ============================================================================
function NodeNetwork() {
    const ref = useRef();
    const positions = useMemo(() => {
        const arr = new Float32Array(2000 * 3);
        for (let i = 0; i < 2000 * 3; i++) {
            arr[i] = (Math.random() - 0.5) * 12;
        }
        return arr;
    }, []);

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x -= delta / 35;
            ref.current.rotation.y -= delta / 50;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color="#00f2fe"
                    size={0.025}
                    sizeAttenuation
                    depthWrite={false}
                    opacity={0.35}
                />
            </Points>
        </group>
    );
}

// ============================================================================
// Main Application
// ============================================================================
function App() {
    // Steps: 0=idle, 1=reading, 2=searching, 3=witness, 4=proving, 5=verifying, 6=complete
    const [currentStep, setCurrentStep] = useState(0);
    const [resultTitle, setResultTitle] = useState("");
    const [resultMsg, setResultMsg] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [statusLog, setStatusLog] = useState([]);

    const steps = [
        { title: "Awaiting File", icon: <UploadCloud size={18} /> },
        { title: "Reading File", icon: <FileSearch size={18} /> },
        { title: "Phrase Search", icon: <Eye size={18} /> },
        { title: "Computing Witness", icon: <Fingerprint size={18} /> },
        { title: "Generating SNARK", icon: <Lock size={18} /> },
        { title: "Network Verify", icon: <Shield size={18} /> },
    ];

    const addLog = (msg) => {
        setStatusLog(prev => [...prev.slice(-8), msg]);
    };

    // ─── Core ZK Proof Flow ──────────────────────────────────────────
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // STEP 1: Read file locally in browser
            setCurrentStep(1);
            addLog(`Reading "${file.name}" (${file.size} bytes)...`);

            const fileText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.readAsText(file);
            });

            await new Promise(r => setTimeout(r, 500));

            // STEP 2: Search for the target phrase
            setCurrentStep(2);
            const phrase = "Confidential: Toxic Waste";
            const M = phrase.length;    // 25
            const maxN = 64;            // Circuit chunk size

            addLog(`Scanning for phrase: "${phrase}"`);

            if (!fileText.includes(phrase)) {
                throw new Error("Target phrase not found in document. Cannot generate proof.");
            }

            addLog("✓ Phrase located in document");
            await new Promise(r => setTimeout(r, 400));

            // STEP 3: Build circuit witness
            setCurrentStep(3);
            addLog("Preparing circuit witness...");

            // Convert string to fixed-size ASCII array
            const textToAscii = (text, length) => {
                const arr = new Array(length).fill(0);
                for (let i = 0; i < Math.min(text.length, length); i++) {
                    arr[i] = text.charCodeAt(i);
                }
                return arr;
            };

            // Find a 64-byte chunk containing the phrase
            const phraseIndex = fileText.indexOf(phrase);
            let startIdx = Math.max(0, phraseIndex - 10);
            // Ensure phrase fits entirely within the chunk
            if (startIdx + maxN < phraseIndex + M) {
                startIdx = phraseIndex; // fallback: start at phrase
            }

            let chunkText = fileText.substring(startIdx, startIdx + maxN);
            if (chunkText.length < maxN) {
                chunkText = chunkText.padEnd(maxN, " ");
            }

            // Verify the chunk contains the phrase (sanity check)
            if (!chunkText.includes(phrase)) {
                throw new Error("Chunk extraction error — phrase not in selected chunk window.");
            }

            addLog(`Chunk extracted: offset ${startIdx}, size ${maxN}`);

            // Prepare circuit input
            // Note: root and pathElements are set to match the circuit's expected format.
            // In production, these would come from the real Merkle tree builder.
            const circuitInput = {
                root: "0", // Will be computed by the circuit's Merkle checker
                targetPhrase: textToAscii(phrase, M),
                documentChunk: textToAscii(chunkText, maxN),
                pathElements: Array(10).fill("0"), // Merkle path (10 = circuit depth)
                pathIndices: Array(10).fill("0"),
                // EdDSA inputs (dummy when ENABLE_EDDSA=0)
                Ax: "0",
                Ay: "0",
                R8x: "0",
                R8y: "0",
                S: "0"
            };

            addLog("Witness prepared");
            await new Promise(r => setTimeout(r, 300));

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
            addLog("Transmitting proof to verification network...");

            const res = await fetch("/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proof, publicSignals }),
            });

            const data = await res.json();

            // STEP 6: Show result
            setCurrentStep(6);

            if (data.verified) {
                setIsSuccess(true);
                setResultTitle("Authentication Verified");
                setResultMsg("Zero-Knowledge proof verified successfully. The document contains the required phrase and the proof is cryptographically sound.");
                addLog("✓ VERIFICATION PASSED");
            } else {
                setIsSuccess(false);
                setResultTitle("Verification Failed");
                setResultMsg(data.message || "The cryptographic proof could not be verified.");
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

    const resetProcess = () => {
        setCurrentStep(0);
        setResultTitle("");
        setResultMsg("");
        setStatusLog([]);
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

            <div className="split-container">
                {/* ─── LEFT: Hero ──────────────────────────── */}
                <section className="hero-panel">
                    <div className="brand">
                        <ShieldAlert className="brand-icon" size={26} />
                        <span className="brand-name">Whistleblower-ZK</span>
                    </div>

                    <div className="hero-content">
                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        >
                            Zero-Knowledge<br />
                            <span className="gradient-text">Document Proof</span>
                        </motion.h1>

                        <motion.p
                            className="hero-description"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                        >
                            Prove a classified document contains sensitive information
                            without revealing the file, your identity, or your location.
                            Powered by Groth16 zk-SNARKs.
                        </motion.p>

                        <motion.div
                            className="tech-badges"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 1, delay: 0.5 }}
                        >
                            <span className="badge"><Cpu size={12} /> Groth16</span>
                            <span className="badge"><Lock size={12} /> Poseidon Hash</span>
                            <span className="badge"><Shield size={12} /> Circom Circuit</span>
                            <span className="badge"><EyeOff size={12} /> Zero Knowledge</span>
                        </motion.div>
                    </div>

                    <div className="hero-footer">
                        <div className="info-row">
                            <span>v2.0.0</span>
                            <span>•</span>
                            <span>CNS Project</span>
                            <span>•</span>
                            <span>Client-Side Proving</span>
                        </div>
                    </div>
                </section>

                {/* ─── RIGHT: Command Center ──────────────── */}
                <section className="command-panel">
                    <div className="glass-card">
                        {/* Header */}
                        <div className="card-header">
                            <h2>Command Center</h2>
                            <div className="status-pill">
                                <div className={`status-dot ${currentStep > 0 && currentStep < 6 ? "active" : "idle"}`} />
                                <span>
                                    {currentStep === 0 ? "System Idle" :
                                        currentStep === 6 ? "Complete" : "Processing"}
                                </span>
                            </div>
                        </div>

                        {/* Progress Timeline */}
                        <div className="timeline">
                            {steps.map((step, i) => {
                                const isActive = currentStep === i + 1;
                                const isPast = currentStep > i + 1 || (currentStep === 6 && i < 6);
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
                                {/* IDLE */}
                                {currentStep === 0 && (
                                    <motion.div
                                        key="upload"
                                        initial={{ opacity: 0, scale: 0.97 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ duration: 0.3 }}
                                        className="upload-zone"
                                    >
                                        <div className="dropzone">
                                            <UploadCloud size={44} className="drop-icon" strokeWidth={1.5} />
                                            <h3>Drop classified file here</h3>
                                            <p>File is read locally — never uploaded to any server.</p>
                                            <label className="btn-primary" id="file-upload-btn">
                                                <input type="file" onChange={handleFileUpload} />
                                                Browse Secure File
                                            </label>
                                        </div>
                                    </motion.div>
                                )}

                                {/* PROCESSING */}
                                {currentStep > 0 && currentStep < 6 && (
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
                                            <h3>{steps[currentStep - 1]?.title || "Processing"}</h3>
                                            <div className="log-feed">
                                                {statusLog.map((log, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="log-line"
                                                    >
                                                        <span className="log-bullet">›</span>
                                                        <span className="log-text">{log}</span>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* COMPLETE */}
                                {currentStep === 6 && (
                                    <motion.div
                                        key="result"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`result-view ${isSuccess ? "success" : "error"}`}
                                    >
                                        <div className="result-icon-wrap">
                                            {isSuccess ? <CheckCircle size={56} /> : <XCircle size={56} />}
                                        </div>
                                        <h3>{resultTitle}</h3>
                                        <p>{resultMsg}</p>
                                        <div className="result-actions">
                                            <button className="btn-primary" onClick={resetProcess}>
                                                Authenticate Another
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default App;
