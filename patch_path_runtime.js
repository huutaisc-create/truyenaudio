const fs = require('fs');
const path = require('path');

const filePath = path.join('node_modules', '@mintplex-labs', 'piper-tts-web', 'dist', 'piper-tts-web.js');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace usage of PATH_MAP[...] with dynamic check
    // We need to capture both "this.voiceId" and "voiceId" cases
    // 1. replace `PATH_MAP[this.voiceId]`
    // 2. replace `PATH_MAP[voiceId]`

    const dynamicLookup = '((typeof window !== "undefined" && window.PIPER_CUSTOM_PATHS && window.PIPER_CUSTOM_PATHS[VOICE_ID_PLACEHOLDER]) || PATH_MAP[VOICE_ID_PLACEHOLDER])';

    // Case 1: this.voiceId
    if (content.includes('PATH_MAP[this.voiceId]')) {
        const replacement = dynamicLookup.replace(/VOICE_ID_PLACEHOLDER/g, 'this.voiceId');
        content = content.replace(/PATH_MAP\[this\.voiceId\]/g, replacement);
        console.log('Patched PATH_MAP[this.voiceId]');
    }

    // Case 2: voiceId (careful not to double patch if logic overlaps, but regex helps)
    // We use regex to find `PATH_MAP[voiceId]` where voiceId is a variable name (usually simple text)
    // But wait, `voiceId` variable name might differ in minified code? 
    // Based on my grep, it seems to be `voiceId` or `this.voiceId`.

    // Let's protect against breaking changes in library variables. 
    // "const path = PATH_MAP[voiceId];"

    content = content.replace(/PATH_MAP\[([^\]]+)\]/g, (match, p1) => {
        // p1 is the key, e.g. "voiceId" or "this.voiceId" or "ar_JO-kareem-low" (if literal string)
        // We only want to patch if it looks like a variable, not a literal string key
        if (p1.startsWith('"') || p1.startsWith("'")) return match; // Skip literals inside obj definition
        // Skip if already patched
        if (match.includes('window.PIPER_CUSTOM_PATHS')) return match;

        return `((typeof window !== "undefined" && window.PIPER_CUSTOM_PATHS && window.PIPER_CUSTOM_PATHS[${p1}]) || PATH_MAP[${p1}])`;
    });

    console.log('Patched general PATH_MAP[...] usage');

    fs.writeFileSync(filePath, content);
    console.log('Successfully applied runtime PATH_MAP patch');

} catch (err) {
    console.error('Error patching file:', err);
    process.exit(1);
}
