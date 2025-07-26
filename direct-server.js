#!/usr/bin/env node

// Direct Express server to bypass lambda-local timeout for long AI responses
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = 8891;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.', { 
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Import the chat function directly
const chatHandler = require('./netlify/functions/chat').handler;
const listDocsHandler = require('./netlify/functions/list-docs').handler;

// Custom wrapper to simulate Netlify function environment but without timeout
async function simulateNetlifyFunction(handler, req, res) {
    try {
        // Create event object similar to what Netlify would provide
        const event = {
            httpMethod: req.method,
            headers: {
                ...req.headers,
                'x-forwarded-for': req.ip,
                'client-ip': req.ip
            },
            body: req.method === 'POST' ? JSON.stringify(req.body) : null,
            queryStringParameters: req.query || {},
            path: req.path,
            isBase64Encoded: false
        };

        // Add timeout override for the AI function
        const originalTimeout = setTimeout;
        global.setTimeout = (fn, delay) => {
            // Allow unlimited timeout for AI processing
            if (delay === 30000) {
                console.log(`🚀 Bypassing 30s timeout for long AI response`);
                return originalTimeout(fn, 300000); // 5 minutes instead
            }
            return originalTimeout(fn, delay);
        };

        const startTime = Date.now();
        console.log(`🤖 Starting ${req.path} request (no timeout limit)`);
        
        // Call the actual Netlify function
        const result = await handler(event);
        
        const duration = Date.now() - startTime;
        console.log(`✅ ${req.path} completed in ${duration}ms`);
        
        // Restore original timeout
        global.setTimeout = originalTimeout;
        
        // Send response
        res.status(result.statusCode || 200);
        
        // Set headers if provided
        if (result.headers) {
            Object.entries(result.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
            });
        }
        
        res.send(result.body);
        
    } catch (error) {
        console.error(`❌ Error in ${req.path}:`, error.message);
        res.status(500).json({ 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Routes for Netlify functions
app.post('/.netlify/functions/chat', (req, res) => {
    simulateNetlifyFunction(chatHandler, req, res);
});

app.get('/.netlify/functions/list-docs', (req, res) => {
    simulateNetlifyFunction(listDocsHandler, req, res);
});

// Serve docs files directly
app.get('/docs/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'docs', filename);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Direct Express Server Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📱 Application: http://localhost:${PORT}`);
    console.log(`🤖 Chat API: http://localhost:${PORT}/.netlify/functions/chat`);
    console.log(`📚 Docs API: http://localhost:${PORT}/.netlify/functions/list-docs`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 Features:');
    console.log('  • No 30-second lambda timeout limit');
    console.log('  • Full Gemini 2.5 Pro detailed responses');
    console.log('  • Real-time streaming progress');
    console.log('  • Unlimited response length');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Direct Express Server...');
    process.exit(0);
});
