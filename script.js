document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const chatLog = document.getElementById('chat-log');
    const loadingIndicator = document.getElementById('loading-indicator');

    const sendMessage = async () => {
        const prompt = userInput.value.trim();
        if (!prompt) return;

        // Display user message
        addMessage(prompt, 'user-message');
        userInput.value = '';
        loadingIndicator.classList.remove('hidden');

        try {
            // This is the crucial part: we call our own back-end function, not Google's API directly.
            const response = await fetch('/.netlify/functions/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            addMessage(data.text, 'ai-message');

        } catch (error) {
            console.error('Error fetching AI response:', error);
            addMessage('Sorry, something went wrong. Please try again.', 'ai-message');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    };

    const addMessage = (text, className) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;
        messageDiv.textContent = text;
        chatLog.appendChild(messageDiv);
        chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll
    };

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});