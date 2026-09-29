// System prompt encryption utility (AES-256-GCM). Run without arguments for usage.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

try {
    require('dotenv').config();
} catch {
    console.log('dotenv is not installed; relying on environment variables.');
}

const ALGORITHM = 'aes-256-gcm';
const RAW_DIR = path.resolve('SystemPrompts', 'Raw');
const ENCRYPTED_DIR = path.resolve('SystemPrompts', 'Encrypted');
const newKey = () => crypto.randomBytes(32).toString('hex');
const USAGE = `Usage:
  node encrypt-prompt.js encrypt <prompt-name>   Encrypts SystemPrompts/Raw/<prompt-name>.txt
  node encrypt-prompt.js decrypt <prompt-name>   Tests decryption of SystemPrompts/Encrypted/<prompt-name>.json
  node encrypt-prompt.js generate-key            Generates a new encryption key

<prompt-name> is the base filename without extension (e.g. "Prism").
An encryption key must be set in the SYSTEM_PROMPT_KEY environment variable in your .env file.`;

function getKey() {
    const hex = process.env.SYSTEM_PROMPT_KEY?.trim();
    if (!hex) throw new Error(`SYSTEM_PROMPT_KEY is not set in your .env file. Generate one and add it:\nSYSTEM_PROMPT_KEY=${newKey()}`);
    if (!/^[a-fA-F0-9]{64}$/.test(hex)) throw new Error('SYSTEM_PROMPT_KEY must be a 64-character hexadecimal string.');
    return Buffer.from(hex, 'hex');
}

function encrypt(name) {
    const key = getKey();
    const input = path.join(RAW_DIR, `${name}.txt`);
    if (!fs.existsSync(input)) throw new Error(`Input file not found at ${input}`);
    // Normalize line endings and remove BOM
    const text = fs.readFileSync(input, 'utf8').replace(/\r\n/g, '\n').replace(/^﻿/, '');
    if (!text.trim()) throw new Error(`${input} is empty.`);

    const iv = crypto.randomBytes(12); // 12 bytes is standard for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const output = path.join(ENCRYPTED_DIR, `${name}.json`);
    fs.mkdirSync(ENCRYPTED_DIR, { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex'), encrypted: encrypted.toString('hex') }, null, 2));
    console.log(`Success! Encrypted prompt saved to ${output}\nYou can now commit this file safely.`);
}

function decrypt(name) {
    const key = getKey();
    const input = path.join(ENCRYPTED_DIR, `${name}.json`);
    if (!fs.existsSync(input)) throw new Error(`Encrypted file not found at ${input}`);
    const { iv, authTag, encrypted } = JSON.parse(fs.readFileSync(input, 'utf8'));
    if (!iv || !authTag || !encrypted) {
        throw new Error('The encrypted file is malformed. It must contain "iv", "authTag", and "encrypted" keys. Please re-encrypt your prompt.');
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const text = Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
    const output = path.join(RAW_DIR, `${name}.decrypted.txt`);
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(output, text, 'utf8');
    console.log(`Decryption successful! Decrypted text saved to ${output}\n\n--- Decrypted Text (first 100 chars) ---\n${text.substring(0, 100)}...`);
}

function generateKey() {
    console.log(`Add this to your .env file:\nSYSTEM_PROMPT_KEY=${newKey()}\n\nKEEP THIS KEY SECURE! Do not share it or commit it to version control.`);
}

const COMMANDS = { encrypt, decrypt, 'generate-key': generateKey };
const [command, promptName] = process.argv.slice(2);

console.log('System Prompt Encryption/Decryption Utility\n');
if (!COMMANDS[command] || (command !== 'generate-key' && !promptName)) {
    if (command && !COMMANDS[command]) console.error(`Unknown command: ${command}\n`);
    console.log(USAGE);
} else {
    try {
        COMMANDS[command](promptName);
    } catch (error) {
        console.error(`${command} failed: ${error.message}`);
        process.exitCode = 1;
    }
}
