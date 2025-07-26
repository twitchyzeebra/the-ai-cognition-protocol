// Helper to load and decrypt the system prompt
const fs = require('fs');
const path = require('path');
const { decrypt } = require('../../encrypt-prompt');

function loadSystemPrompt() {
    const encryptedPath = path.resolve(__dirname, '../../system-prompt-encrypted.json');
    if (!fs.existsSync(encryptedPath)) {
        throw new Error('system-prompt-encrypted.json not found');
    }
    const encryptedFile = fs.readFileSync(encryptedPath, 'utf8');
    const encryptedData = JSON.parse(encryptedFile);
    const key = process.env.SYSTEM_PROMPT_KEY;
    if (!key || key.length !== 64) {
        throw new Error('SYSTEM_PROMPT_KEY env variable missing or invalid');
    }
    return decrypt(encryptedData.data, key);
}

module.exports = { loadSystemPrompt };
