const crypto = require('crypto');
const fs = require('fs');
// Load .env file if present
try {
    require('dotenv').config();
    console.log('Loaded .env file');
    // Force reload the environment
    delete require.cache[require.resolve('dotenv')];
    require('dotenv').config();
} catch (e) {
    console.log('No .env file loaded');
}


const algorithm = 'aes-256-gcm';

function getKey(keyHex) {
    // Always treat key as a 64-char hex string
    if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
        throw new Error('Encryption key must be a 64-character hex string');
    }
    return Buffer.from(keyHex, 'hex');
}

function encrypt(text, password) {
    const key = getKey(password);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        method: 'aes-256-gcm'
    };
}

function decrypt(encryptedData, password) {
    const key = getKey(password);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Usage instructions
console.log('System Prompt Encryption Utility');
console.log('================================');
console.log('');
console.log('To encrypt your system prompt:');
console.log('1. Create a file called "system-prompt.txt" with your full system prompt');
console.log('2. Run: node encrypt-prompt.js encrypt');
console.log('');
console.log('To test decryption:');
console.log('Run: node encrypt-prompt.js decrypt');


const command = process.argv[2];
const userKeyArg = process.argv[3];

if (command === 'encrypt') {
    try {
        const promptPath = require('path').resolve('system-prompt.txt');
        let systemPrompt = fs.readFileSync(promptPath, 'utf8');
        // Remove BOM if present
        if (systemPrompt.charCodeAt(0) === 0xFEFF) {
            systemPrompt = systemPrompt.slice(1);
        }
        // Normalize line endings
        systemPrompt = systemPrompt.replace(/\r\n/g, '\n');
        if (!systemPrompt || systemPrompt.length < 10) {
            throw new Error('system-prompt.txt is empty or too short');
        }

        // Use SYSTEM_PROMPT_KEY from .env if present, else generate a random key
        let encryptionKey;
        const envKey = process.env.SYSTEM_PROMPT_KEY ? process.env.SYSTEM_PROMPT_KEY.trim() : '';
        // Check if we have a valid 64-character hex key (not a placeholder)
        if (envKey && envKey.length === 64 && /^[a-fA-F0-9]{64}$/.test(envKey) && envKey !== '<your-key-here>') {
            encryptionKey = envKey;
            console.log('Using SYSTEM_PROMPT_KEY from .env for encryption.');
        } else {
            encryptionKey = crypto.randomBytes(32).toString('hex');
            console.log('No valid SYSTEM_PROMPT_KEY found in .env, generated random key for encryption.');
            console.log('New key for your .env file:', encryptionKey);
        }

        // Encrypt the prompt
        const encrypted = encrypt(systemPrompt, encryptionKey);
        // Ensure encrypted field is present
        if (!encrypted.encrypted || encrypted.encrypted.length < 10) {
            throw new Error('Encryption failed: encrypted field is missing or too short');
        }
        // Save encrypted data to a JSON file, ensuring all fields are present
        const encryptedData = {
            data: {
                encrypted: encrypted.encrypted,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
                method: encrypted.method
            },
            info: 'This file contains an encrypted system prompt. The decryption key should be stored as SYSTEM_PROMPT_KEY environment variable.'
        };
        fs.writeFileSync('system-prompt-encrypted.json', JSON.stringify(encryptedData, null, 2));

        console.log('✅ System prompt encrypted successfully!');
        console.log('Encrypted preview:', encrypted.encrypted.substring(0, 100));
        console.log('Encrypted length:', encrypted.encrypted.length);
        console.log('');
        console.log('📝 Next steps:');
        console.log('1. Add this encryption key to your Netlify environment variables:');
        console.log('   Key: SYSTEM_PROMPT_KEY');
        console.log('   Value:', encryptionKey);
        console.log('');
        console.log('2. The encrypted file "system-prompt-encrypted.json" can be safely committed to your repo');
        console.log('3. Delete the original "system-prompt.txt" file for security');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('Make sure "system-prompt.txt" exists in the current directory and is not empty');
    }
} else if (command === 'decrypt') {
    try {
        // Read encrypted data
        const encryptedFile = fs.readFileSync('system-prompt-encrypted.json', 'utf8');
        const encryptedData = JSON.parse(encryptedFile);

        // Get encryption key from environment or prompt
        let encryptionKey = process.env.SYSTEM_PROMPT_KEY;
        
        // Fallback: read directly from .env file if environment variable is not set correctly
        if (!encryptionKey || encryptionKey === '<your-key-here>') {
            try {
                const envContent = fs.readFileSync('.env', 'utf8');
                const keyMatch = envContent.match(/SYSTEM_PROMPT_KEY=([a-fA-F0-9]{64})/);
                if (keyMatch) {
                    encryptionKey = keyMatch[1];
                    console.log('Read SYSTEM_PROMPT_KEY directly from .env file');
                }
            } catch (e) {
                console.log('Could not read .env file directly');
            }
        }

        if (!encryptionKey) {
            console.log('❌ SYSTEM_PROMPT_KEY environment variable not found');
            process.exit(1);
        }

        // Decrypt the prompt
        const decrypted = decrypt(encryptedData.data, encryptionKey);

        console.log('✅ Decryption successful!');
        console.log('📄 System prompt preview (first 200 characters):');
        console.log(decrypted.substring(0, 200) + '...');
        console.log('');
        console.log('Full length:', decrypted.length, 'characters');

    } catch (error) {
        console.error('❌ Decryption failed:', error.message);
    }
} else {
    console.log('Usage: node encrypt-prompt.js [encrypt|decrypt]');
}

module.exports = { encrypt, decrypt };
