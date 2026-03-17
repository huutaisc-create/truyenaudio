const fs = require('fs');
const path = require('path');

const filePath = path.join('node_modules', '@mintplex-labs', 'piper-tts-web', 'dist', 'piper-tts-web.js');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if already patched
    if (content.includes('window.PIPER_CUSTOM_PATHS')) {
        console.log('File already patched for custom paths.');
        process.exit(0);
    }

    const sizeBefore = content.length;
    // Inject the window object merge into PATH_MAP
    content = content.replace(
        'const PATH_MAP = {',
        'const PATH_MAP = { ...((typeof window !== "undefined" && window.PIPER_CUSTOM_PATHS) || {}),'
    );

    if (content.length === sizeBefore) {
        console.error('Could not find "const PATH_MAP = {" to patch.');
        process.exit(1);
    }

    fs.writeFileSync(filePath, content);
    console.log('Successfully patched piper-tts-web.js for custom paths');
} catch (err) {
    console.error('Error patching file:', err);
    process.exit(1);
}
