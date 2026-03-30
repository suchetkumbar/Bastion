import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, EyeOff, FileText, HelpCircle, ChevronRight } from 'lucide-react';

export default function AboutTab() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: "1. Document Pre-registration",
      icon: <FileText size={24} />,
      content: "Authorized organizations hash classified documents in chunks and build a Merkle Tree. Only the single cryptographic 'Root' is published to our registry. The actual document content is never uploaded or shared."
    },
    {
      title: "2. Local Scanning",
      icon: <EyeOff size={24} />,
      content: "When a whistleblower wants to prove authenticity, they select the document locally. Our system scans it entirely in their browser. It proves ownership by hashing the chunks and matching with the public Merkle Root—without sending a single byte."
    },
    {
      title: "3. Zero-Knowledge Proof",
      icon: <Lock size={24} />,
      content: "Using Groth16 zk-SNARKs and Poseidon hashing via WebAssembly, the browser generates a tiny cryptographic proof. This mathematics guarantees that the user possesses a valid document containing the target phrase, without revealing which one."
    },
    {
      title: "4. Anonymous Verification",
      icon: <ShieldCheck size={24} />,
      content: "The generated SNARK proof is sent to the server. The server verifies the mathematics using a public key. IP addresses are stripped, metadata is scrubbed, and replay attacks are blocked by logging the proof's unique fingerprint."
    }
  ];

  const faqs = [
    {
      q: "What makes this system 'Zero-Knowledge'?",
      a: "The verifying server mathematically checks the proof but learns absolutely nothing about the document content itself, the specific chunk where the phrase exists, or the user's identity. It only learns that 'the statement is true'."
    },
    {
      q: "Why was Groth16 chosen instead of PLONK or STARKs?",
      a: "Groth16 produces exceptionally small proof sizes (under 300 bytes) and boasts incredibly fast verification times (a few milliseconds). This makes it ideal for running in browsers, despite its drawback of requiring a trusted setup ceremony."
    },
    {
      q: "How does the system prevent replay attacks?",
      a: "Every generated proof has a unique 'fingerprint' based on its non-malleable cryptographic properties. The server logs these fingerprints. If a malicious actor intercepts a proof and tries to resubmit it, the server rejects it as a 'replay'."
    },
    {
      q: "What happens if a user alters the document by even one character?",
      a: "A single altered character changes that chunk's hash entirely due to the avalanche effect. This breaks the Merkle path. The generated SNARK proof will be invalid, and the server will reject it as mathematically unsound."
    },
    {
      q: "How are the user's IP and metadata protected?",
      a: "The application processes the file locally within the browser context. When sending the proof, the Node.js server acts as an anonymity proxy—stripping all HTTP headers, removing origin metadata, and returning a zero-knowledge policy header."
    }
  ];

  return (
    <div className="about-tab-content">
      <div className="about-header">
        <h2>Architecture & Mechanism</h2>
        <p>A completely localized, browser-based Zero-Knowledge architecture.</p>
      </div>

      <div className="interactive-explanation">
        <div className="explanation-steps">
          {steps.map((step, idx) => (
            <div 
              key={idx} 
              className={`explanation-step-btn ${activeStep === idx ? 'active' : ''}`}
              onClick={() => setActiveStep(idx)}
            >
              <div className="step-icon">
                {step.icon}
              </div>
              <div className="step-title">{step.title}</div>
              <ChevronRight className="step-arrow" size={16} />
            </div>
          ))}
        </div>
        
        <div className="explanation-viewer">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="explanation-detail"
            >
              <div className="detail-icon">{steps[activeStep].icon}</div>
              <h3>{steps[activeStep].title}</h3>
              <p>{steps[activeStep].content}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="faq-section">
        <div className="faq-header">
          <HelpCircle size={20} className="faq-icon" />
          <h3>Teacher Viva Questions (FAQ)</h3>
        </div>
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <div key={i} className="faq-item">
              <div className="faq-question">
                <span className="q-label">Q:</span> {faq.q}
              </div>
              <div className="faq-answer">
                <span className="a-label">A:</span> {faq.a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
