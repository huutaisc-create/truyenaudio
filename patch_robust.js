const fs = require('fs');
const path = require('path');

const filePath = path.join('node_modules', '@mintplex-labs', 'piper-tts-web', 'dist', 'piper-tts-web.js');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Force HF_BASE to be dynamic and absolute local path
    // We locate the definition "const HF_BASE ="
    if (content.includes('const HF_BASE = "/models"')) {
        // Already patched? Let's update it to be more robust
        content = content.replace(
            'const HF_BASE = "/models"',
            'const HF_BASE = (typeof window !== "undefined" ? window.location.origin + "/models" : "/models")'
        );
    } else if (content.includes('const HF_BASE = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main"')) {
        content = content.replace(
            'const HF_BASE = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main"',
            'const HF_BASE = (typeof window !== "undefined" ? window.location.origin + "/models" : "/models")'
        );
    } else {
        console.log('Could not find standard HF_BASE definition to patch.');
    }

    // 2. Inject Logging into the fetch/url usage (Heuristic: finding where urls are constructed or used)
    // We found "if (!url.match" earlier. Let's add logging before it.

    if (content.includes('if (!url.match("https://huggingface.co"))')) {
        content = content.replace(
            'if (!url.match("https://huggingface.co"))',
            'console.log("Piper Fetching:", url); if (false && !url.match("https://huggingface.co"))'
        );
    } else if (content.includes('if (false && !url.match("https://huggingface.co"))')) {
        // Already patched limit, just ensure logging matches
        if (!content.includes('console.log("Piper Fetching:", url)')) {
            content = content.replace(
                'if (false && !url.match("https://huggingface.co"))',
                'console.log("Piper Fetching:", url); if (false && !url.match("https://huggingface.co"))'
            );
        }
    }

    fs.writeFileSync(filePath, content);
    console.log('Applied robust patch to piper-tts-web.js');

} catch (err) {
    console.error('Error patching file:', err);
    process.exit(1);
}
