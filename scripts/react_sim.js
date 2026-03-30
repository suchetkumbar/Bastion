import fs from 'fs';

// Recreate exactly what App.jsx does logically.
// 1. Read file with utf8 -> Uint8Array simulating browser FileReader
const buffer = new Uint8Array(fs.readFileSync('test_documents/pass_acmechem_memo.txt')).buffer;
const rawFileBytes = new Uint8Array(buffer);
const fileBytes = [];
for (let i = 0; i < rawFileBytes.length; i++) {
    if (rawFileBytes[i] !== 13) fileBytes.push(rawFileBytes[i]);
}

const CHUNK_SIZE = 64;
const chunks = [];
for (let i = 0; i < fileBytes.length; i += CHUNK_SIZE) {
    const chunk = new Array(CHUNK_SIZE).fill(32);
    for (let j = 0; j < CHUNK_SIZE && (i + j) < fileBytes.length; j++) {
        chunk[j] = fileBytes[i + j];
    }
    chunks.push(chunk);
}

const targetPhrase = "Confidential: Toxic Waste";
let phraseChunkIndex = -1;
for (let i = 0; i < chunks.length; i++) {
    const chunkStr = String.fromCharCode(...chunks[i]);
    if (chunkStr.includes(targetPhrase)) {
        phraseChunkIndex = i;
        break;
    }
}

console.log("phraseChunkIndex:", phraseChunkIndex);
console.log("Chunk bytes:", chunks[phraseChunkIndex]);
console.log("String chunk:", String.fromCharCode(...chunks[phraseChunkIndex]));

const registry = JSON.parse(fs.readFileSync('web/server/document_store/' + fs.readdirSync('web/server/document_store').find(f => JSON.parse(fs.readFileSync('web/server/document_store/'+f)).name.includes('Acme'))));

console.log("Server leaf hash for this index:", registry.chunkHashes[phraseChunkIndex]);

const pathElements = [];
const pathIndices = [];
let currentIndex = phraseChunkIndex;

const tree = registry.tree;

for (let level = 0; level < 5; level++) {
    const isRight = currentIndex % 2;
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
    
    if (tree[level]) {
        pathElements.push(
            tree[level][siblingIndex] !== undefined 
                ? tree[level][siblingIndex].toString() 
                : "0"
        );
    } else {
        pathElements.push("0");
    }
    
    pathIndices.push(isRight);
    currentIndex = Math.floor(currentIndex / 2);
}

console.log("pathIndices:", pathIndices);
console.log("pathElements:", pathElements);
console.log("Root from path:", registry.merkleRoot);
