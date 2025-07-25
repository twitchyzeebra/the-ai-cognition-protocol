const fs = require('fs');
const path = require('path');

// Find the docs directory relative to the function file
const getDocsDir = () => {
    // Always resolve docs as one level up from netlify/functions
    return path.resolve(__dirname, '..', '..', 'docs');
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

exports.handler = async () => {
    const docsDir = getDocsDir();
    console.log("Docs directory resolved to:", docsDir);
    let structure = [];
    if (fs.existsSync(docsDir)) {
        const files = fs.readdirSync(docsDir);
        console.log("Docs directory contents:", files);
        structure = listFiles(docsDir);
        console.log("Docs found:", structure);
    } else {
        console.log("Docs directory does not exist.");
    }
    return {
        statusCode: 200,
        body: JSON.stringify(structure)
    };
};
  

