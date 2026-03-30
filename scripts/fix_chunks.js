const fs = require('fs');

const files = [
    'test_documents/pass_acmechem_memo.txt',
    'test_documents/pass_petroglobe_report.txt',
    'test_documents/pass_novapharma_audit.txt',
    'test_documents/pass_steelworks_assessment.txt',
    'test_documents/pass_agricorp_memo.txt',
    'test_documents/pass_minecore_memo.txt'
];

files.forEach(f => {
    let text = fs.readFileSync(f, 'utf8');
    // Strip \r universally to simulate normalized behavior
    text = text.replace(/\r/g, '');
    let idx = text.indexOf('Confidential: Toxic Waste');
    
    if (idx !== -1) {
        let offset = idx % 64;
        let fits = (offset + 25) <= 64;
        
        console.log(`${f.padEnd(45)} idx: ${idx}, offset: ${offset}, fits: ${fits}`);
        
        if (!fits) {
            // Need to shift idx forward so offset is 0
            // How many spaces to add before the phrase?
            // The next boundary is idx - offset + 64
            let neededSpaces = 64 - offset;
            console.log(`  -> Shifting by padding ${neededSpaces} spaces before the phrase.`);
            
            // Reconstruct text
            const before = text.substring(0, idx);
            const after = text.substring(idx);
            const spaces = " ".repeat(neededSpaces);
            
            const newText = before + spaces + after;
            
            // Verify
            const newIdx = newText.indexOf('Confidential: Toxic Waste');
            console.log(`  -> New idx: ${newIdx}, new offset: ${newIdx % 64}, fits: ${(newIdx%64)+25 <= 64}`);
            
            // Save to disk (we can write it with \n only now, doesn't matter since server/app norm it)
            fs.writeFileSync(f, newText, 'utf8');
        }
    }
});
