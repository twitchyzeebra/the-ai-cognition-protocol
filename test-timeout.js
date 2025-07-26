// Simple test to verify timeout handling
const fs = require('fs');
const path = require('path');

// Test if netlify.toml has correct timeout configuration
const netlifyToml = fs.readFileSync(path.join(__dirname, 'netlify.toml'), 'utf8');

console.log('Checking netlify.toml timeout configuration...');

const checks = [
    { pattern: /timeout = 600/, description: 'Global functions timeout' },
    { pattern: /functionsTimeout = 600/, description: 'Dev functions timeout' },
    { pattern: /\[functions\.chat\][\s\S]*?timeout = 600/, description: 'Chat function specific timeout' }
];

let allPassed = true;

checks.forEach(check => {
    if (check.pattern.test(netlifyToml)) {
        console.log('✅', check.description, 'configured correctly');
    } else {
        console.log('❌', check.description, 'NOT found');
        allPassed = false;
    }
});

if (allPassed) {
    console.log('\n🎉 All timeout configurations are correct!');
    console.log('\nTroubleshooting tips:');
    console.log('1. Restart netlify dev after configuration changes');
    console.log('2. Check if you have the latest netlify-cli version');
    console.log('3. Try running: netlify dev --timeout=600');
    console.log('4. If still having issues, the problem might be with Gemini API response time');
} else {
    console.log('\n⚠️  Some timeout configurations are missing');
}
