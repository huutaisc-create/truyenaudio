const fs = require('fs');
const path = require('path');

const filePath = path.join('node_modules', '@mintplex-labs', 'piper-tts-web', 'dist', 'piper-tts-web.js');

try {
    let content = fs.readFileSync(filePath, 'utf8');
    const sizeBefore = content.length;
    content = content.replace(
        'const HF_BASE = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main";',
        'const HF_BASE = "/models";'
    );

    if (content.length === sizeBefore) {
        // Maybe double quotes vs single quotes?
        content = content.replace(
            "const HF_BASE = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main';",
            "const HF_BASE = '/models';"
        );
    }

    fs.writeFileSync(filePath, content);
    console.log('Successfully patched piper-tts-web.js');
} catch (err) {
    console.error('Error patching file:', err);
    process.exit(1);
}
