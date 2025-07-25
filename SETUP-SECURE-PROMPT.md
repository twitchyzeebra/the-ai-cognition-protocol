# Secure System Prompt Setup Guide

## Step 1: Create your system prompt file
1. Create a file called `system-prompt.txt` in the root directory
2. Paste your full 10,000-character system prompt into this file
3. Save the file

## Step 2: Encrypt the system prompt
1. Open PowerShell in your project directory
2. Run: `node encrypt-prompt.js encrypt`
3. Copy the encryption key that's displayed (you'll need this for Netlify)

## Step 3: Set up Netlify environment variable
1. Go to your Netlify site dashboard
2. Navigate to Site settings → Environment variables
3. Add a new variable:
   - Key: `SYSTEM_PROMPT_KEY`
   - Value: [paste the encryption key from step 2]
4. Save the variable

## Step 4: Commit and deploy
1. The encrypted file `system-prompt-encrypted.json` will be created
2. Delete the original `system-prompt.txt` file (for security)
3. Commit and push your changes to deploy

## How it works:
- Your system prompt is encrypted locally using AES-256-GCM encryption
- The encrypted file is safe to commit to your repository
- Only the decryption key is stored as an environment variable
- The chat function decrypts the prompt at runtime using the key

## Security benefits:
✅ System prompt content is never visible in your repository
✅ Even if someone accesses your repo, they can't read the prompt without the key
✅ The encryption key is securely stored in Netlify's environment variables
✅ No file size limitations like with environment variables

## Testing:
You can test the decryption locally by setting the environment variable:
```powershell
$env:SYSTEM_PROMPT_KEY="your-encryption-key-here"
node encrypt-prompt.js decrypt
```
