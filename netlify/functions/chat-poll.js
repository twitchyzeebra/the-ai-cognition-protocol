const { Readable } = require('stream');

// This is a simplified in-memory store. For production, you'd use a database.
const responseStore = new Map();

exports.handler = (event) => {
    const { requestId } = event.queryStringParameters;

    if (!requestId) {
        return {
            statusCode: 400,
            body: 'Missing requestId parameter.'
        };
    }

    const streamData = responseStore.get(requestId);

    if (!streamData) {
        return {
            statusCode: 404,
            body: 'Request ID not found or expired.'
        };
    }

    if (streamData.error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: streamData.error })
        };
    }

    const readableStream = new Readable({
        async read() {
            try {
                for await (const chunk of streamData) {
                    this.push(`data: ${JSON.stringify({ text: chunk.text() })}\n\n`);
                }
                this.push(`data: ${JSON.stringify({ done: true })}\n\n`);
                this.push(null);
                responseStore.delete(requestId); // Clean up
            } catch (err) {
                this.push(`data: ${JSON.stringify({ error: 'Error reading stream.' })}\n\n`);
                this.push(null);
                responseStore.delete(requestId); // Clean up
            }
        }
    });

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
        body: readableStream,
    };
};
