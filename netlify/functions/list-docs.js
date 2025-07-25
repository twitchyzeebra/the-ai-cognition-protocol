const fs = require('fs');
const path = require('path');

const fs = require('fs');
const path = require('path');

// Find the docs directory - handle both local dev and production
const getDocsDir = () => {
    // Try multiple possible paths for docs directory
    const possiblePaths = [
        path.resolve(__dirname, '..', '..', 'docs'), // Local dev
        path.resolve(process.cwd(), 'docs'),         // Production root
        path.resolve(__dirname, 'docs'),             // Same level as functions
        '/var/task/docs',                            // Netlify production path
        './docs'                                     // Relative path
    ];
    
    for (const docsPath of possiblePaths) {
        if (fs.existsSync(docsPath)) {
            console.log(`Found docs directory at: ${docsPath}`);
            return docsPath;
        }
    }
    
    console.log('No docs directory found. Tried paths:', possiblePaths);
    return null;
};

function listFiles(dir, baseUrl = 'docs') {
    const result = [];
    if (!fs.existsSync(dir)) return result;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    items.forEach(item => {
        if (item.isDirectory()) {
            result.push({
                type: 'folder',
                name: item.name,
                children: listFiles(path.join(dir, item.name), `${baseUrl}/${item.name}`)
            });
        } else {
            result.push({
                type: 'file',
                name: item.name,
                url: `${baseUrl}/${item.name}`
            });
        }
    });
    return result;
}

exports.handler = async (event) => {
    console.log('Runtime environment:', {
        __dirname,
        'process.cwd()': process.cwd(),
        'process.env.AWS_LAMBDA_FUNCTION_NAME': process.env.AWS_LAMBDA_FUNCTION_NAME,
        'process.env.NETLIFY': process.env.NETLIFY
    });
    
    const docsDir = getDocsDir();
    console.log("Docs directory resolved to:", docsDir);
    
    let structure = [];
    if (docsDir && fs.existsSync(docsDir)) {
        const files = fs.readdirSync(docsDir);
        console.log("Docs directory contents:", files);
        structure = listFiles(docsDir);
        console.log("Docs found:", structure);
    } else {
        console.log("Docs directory does not exist or was not found.");
        
        // Fallback: return hardcoded structure based on known files
        structure = [
            { type: 'file', name: 'Blocking All Emo.txt', url: 'docs/Blocking All Emo.txt' },
            { type: 'file', name: 'Blocking Negative Emo.txt', url: 'docs/Blocking Negative Emo.txt' },
            { type: 'file', name: 'Chapter 1 - Introduction.md', url: 'docs/Chapter 1 - Introduction.md' },
            { type: 'file', name: 'Chapter 2 - The Science.md', url: 'docs/Chapter 2 - The Science.md' }
        ];
        console.log("Using fallback docs structure:", structure);
    }
    
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(structure)
    };
};
  

