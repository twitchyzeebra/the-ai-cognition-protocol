const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load .env file
try {
    require('dotenv').config();
    console.log('Loaded .env file variables.');
} catch (e) {
    console.log('dotenv is not installed or .env file not found. Relying on environment variables.');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // For GCM, 12 bytes is standard
const AUTH_TAG_LENGTH = 16; // For GCM, 16 bytes is standard
const KEY_LENGTH = 32; // For AES-256, 32 bytes (256 bits) is required

/**
 * Validates and returns a Buffer from a hex-encoded key.
 * @param {string} keyHex - The 64-character hex-encoded key.
 * @returns {Buffer} - The key as a Buffer.
 */
function getKey(keyHex) {
    if (!keyHex || typeof keyHex !== 'string' || !/^[a-fA-F0-9]{64}$/.test(keyHex)) {
        throw new Error('SYSTEM_PROMPT_KEY must be a 64-character hexadecimal string.');
    }
    return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts the given text using AES-256-GCM.
 * @param {string} text - The plaintext to encrypt.
 * @param {Buffer} key - The encryption key.
 * @returns {{iv: string, authTag: string, encrypted: string}}
 */
function encrypt(text, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted: encrypted.toString('hex'),
    };
}

/**
 * Decrypts the given encrypted data.
 * @param {{iv: string, authTag: string, encrypted: string}} encryptedData - The encrypted data object.
 * @param {Buffer} key - The decryption key.
 * @returns {string} - The decrypted plaintext.
 */
function decrypt(encryptedData, key) {
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(encryptedData.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData.encrypted, 'hex')), decipher.final()]);
    
    return decrypted.toString('utf8');
}

/**
 * Main function to handle command-line arguments.
 */
function main() {
    console.log('System Prompt Encryption/Decryption Utility');
    console.log('===========================================');

    const command = process.argv[2];
    const promptName = process.argv[3];
    const keyFromEnv = process.env.SYSTEM_PROMPT_KEY ? process.env.SYSTEM_PROMPT_KEY.trim() : null;

    if (!command || (command !== 'generate-key' && !promptName)) {
        console.log('\nUsage:');
        console.log('  node encrypt-prompt.js encrypt <prompt-name>   - Encrypts SystemPrompts/Raw/<prompt-name>.txt');
        console.log('  node encrypt-prompt.js decrypt <prompt-name>   - Tests decryption of SystemPrompts/Encrypted/<prompt-name>.json');
        console.log('  node encrypt-prompt.js generate-key           - Generates a new encryption key');
        console.log('\n<prompt-name> is the base filename without extension (e.g., "system-prompt-relational-cognition").');
        console.log('\nAn encryption key must be set in the SYSTEM_PROMPT_KEY environment variable in your .env file.');
        return;
    }

    if (command === 'encrypt') {
        handleEncryption(keyFromEnv, promptName);
    } else if (command === 'decrypt') {
        handleDecryption(keyFromEnv, promptName);
    } else if (command === 'generate-key') {
        generateKey();
    } else {
        console.error(`\nUnknown command: ${command}`);
    }
}


/**
 * Handles the encryption process.
 * @param {string|null} keyHex - The hex-encoded key from environment variables.
 * @param {string} promptName - The base name of the prompt file.
 */
function handleEncryption(keyHex, promptName) {
    console.log(`\n--- Encrypting: ${promptName} ---`);
    if (!keyHex) {
        console.error('Error: SYSTEM_PROMPT_KEY is not set in your .env file.');
        console.log('Please generate a key and add it to your .env file:');
        console.log(`SYSTEM_PROMPT_KEY=${crypto.randomBytes(KEY_LENGTH).toString('hex')}`);
        return;
    }

    try {
        const key = getKey(keyHex);
        const rawDir = path.resolve('SystemPrompts', 'Raw');
        const encryptedDir = path.resolve('SystemPrompts', 'Encrypted');
        fs.mkdirSync(encryptedDir, { recursive: true });

        const promptPath = path.join(rawDir, `${promptName}.txt`);
        const outputPath = path.join(encryptedDir, `${promptName}.json`);

        if (!fs.existsSync(promptPath)) {
            throw new Error(`Input file not found at ${promptPath}`);
        }

        let systemPrompt = fs.readFileSync(promptPath, 'utf8');
        // Normalize line endings and remove BOM
        systemPrompt = systemPrompt.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');

        if (!systemPrompt.trim()) {
            throw new Error(`${promptPath} is empty.`);
        }

        const encryptedData = encrypt(systemPrompt, key);

        fs.writeFileSync(outputPath, JSON.stringify(encryptedData, null, 2));
        console.log(`Success! Encrypted prompt saved to ${outputPath}`);
        console.log('You can now commit this file safely.');

    } catch (error) {
        console.error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Handles the decryption process for testing.
 * @param {string|null} keyHex - The hex-encoded key from environment variables.
 * @param {string} promptName - The base name of the prompt file.
 */
function handleDecryption(keyHex, promptName) {
    console.log(`\n--- Testing Decryption: ${promptName} ---`);
    if (!keyHex) {
        console.error('Error: SYSTEM_PROMPT_KEY is not set in your .env file.');
        return;
    }

    try {
        const key = getKey(keyHex);
        const encryptedDir = path.resolve('SystemPrompts', 'Encrypted');
        const inputPath = path.join(encryptedDir, `${promptName}.json`);

        if (!fs.existsSync(inputPath)) {
            throw new Error(`Encrypted file not found at ${inputPath}`);
        }

        const encryptedData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        
        // Validate the structure of the encrypted file
        if (!encryptedData.iv || !encryptedData.authTag || !encryptedData.encrypted) {
            throw new Error('The encrypted file is malformed. It must contain "iv", "authTag", and "encrypted" keys. Please re-encrypt your prompt.');
        }

        const decryptedText = decrypt(encryptedData, key);
        const outPath = path.join(path.resolve('SystemPrompts', 'Raw'), `${promptName}.decrypted.txt`);
        fs.writeFileSync(outPath, decryptedText, 'utf8');
        console.log(`Decryption successful! Decrypted text saved to ${outPath}`);

        console.log('Success! Decryption test passed.');
        console.log('\n--- Decrypted Text (first 100 chars) ---');
        console.log(decryptedText.substring(0, 100) + '...');
        
    } catch (error) {
        console.error(`Decryption test failed: ${error.message}`);
    }
}

/**
 * Generates a new encryption key.
 */
function generateKey() {
    const newKey = crypto.randomBytes(KEY_LENGTH).toString('hex');
    console.log('\n--- New Encryption Key Generated ---');
    console.log('\nAdd this to your .env file:');
    console.log(`SYSTEM_PROMPT_KEY=${newKey}`);
    console.log('\nKEEP THIS KEY SECURE! It is used to decrypt your system prompts.');
    console.log('Do not share it or commit it to version control.');
}

main();

