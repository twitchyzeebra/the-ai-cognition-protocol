document.addEventListener('DOMContentLoaded', () => {
    // Chat logic
    const chatInput = document.getElementById('chat-input');
    const chatForm = document.getElementById('chat-form');
    const chatLog = document.getElementById('chat-log');
    const loadingIndicator = document.getElementById('loading-indicator');
    const thinkingTimer = document.getElementById('thinking-timer');
    
    let thinkingInterval = null;
    let thinkingStartTime = null;

    function startThinkingTimer() {
        thinkingStartTime = Date.now();
        thinkingTimer.textContent = '0s';
        thinkingInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - thinkingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            
            if (minutes > 0) {
                thinkingTimer.textContent = `${minutes}m ${seconds}s`;
            } else {
                thinkingTimer.textContent = `${seconds}s`;
            }
        }, 1000);
    }
    
    function stopThinkingTimer() {
        if (thinkingInterval) {
            clearInterval(thinkingInterval);
            thinkingInterval = null;
        }
        // Reset timer display
        thinkingTimer.textContent = '0s';
        thinkingStartTime = null;
    }

    function addMessage(text, className) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;
        
        // For AI messages, preserve formatting and convert markdown
        if (className === 'ai-message') {
            messageDiv.innerHTML = formatAIResponse(text);
        } else {
            messageDiv.textContent = text;
        }
        
        chatLog.appendChild(messageDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    // Format AI responses with proper markdown rendering
    function formatAIResponse(text) {
        return text
            // Preserve line breaks
            .replace(/\n/g, '<br>')
            // Convert headers
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Convert bold text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Convert italic text  
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Convert bullet points
            .replace(/^\* (.+)$/gm, '<li>$1</li>')
            // Wrap consecutive list items in ul tags
            .replace(/((?:<li>.*<\/li><br>)+)/g, '<ul>$1</ul>')
            // Clean up extra breaks in lists
            .replace(/<\/li><br>/g, '</li>')
            // Convert numbered lists
            .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
            // Convert code blocks (triple backticks)
            .replace(/```(.+?)```/gs, '<pre><code>$1</code></pre>')
            // Convert inline code
            .replace(/`(.+?)`/g, '<code>$1</code>');
    }

    async function sendMessage(e) {
        if (e) e.preventDefault();
        const prompt = chatInput.value.trim();
        if (!prompt) return;
        addMessage(prompt, 'user-message');
        chatInput.value = '';
        
        // Start thinking timer and show loading
        loadingIndicator.classList.remove('hidden');
        startThinkingTimer();
        
        // Add placeholder message that will be updated
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'message ai-message streaming';
        aiMessageDiv.textContent = 'AI is thinking...';
        chatLog.appendChild(aiMessageDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
        
        try {
            const response = await fetch('/.netlify/functions/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            
            if (response.status === 206) {
                // Partial content due to local dev timeout
                const data = await response.json();
                aiMessageDiv.innerHTML = formatAIResponse(data.text + '\n\n[Note: Response truncated due to local development timeout limits]');
                aiMessageDiv.classList.remove('streaming');
                return;
            }
            
            if (response.status === 408) {
                const errorData = await response.json();
                aiMessageDiv.innerHTML = formatAIResponse('Request timed out. Please try a shorter message or try again later.');
                aiMessageDiv.classList.remove('streaming');
                return;
            }
            
            if (response.status === 429) {
                const errorData = await response.json();
                aiMessageDiv.innerHTML = formatAIResponse('Rate limit exceeded. Please wait before sending another message. (Maximum 4 messages per minute)');
                aiMessageDiv.classList.remove('streaming');
                return;
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Handle streaming response
            if (data.streaming) {
                // Apply formatting to the AI response
                aiMessageDiv.innerHTML = formatAIResponse(data.text);
                
                // Add metadata about the response
                const metaDiv = document.createElement('div');
                metaDiv.className = 'response-meta';
                let metaText = `Generated in ${(data.duration/1000).toFixed(1)}s • ${data.chunks} chunks • ${data.text.length} characters`;
                
                if (data.partial) {
                    metaText += ' • ⚠️ Partial response (time limit reached)';
                    metaDiv.style.color = '#ff9800';
                }
                
                metaDiv.innerHTML = `<small>${metaText}</small>`;
                aiMessageDiv.appendChild(metaDiv);
            } else {
                aiMessageDiv.innerHTML = formatAIResponse(data.text);
            }
            
            aiMessageDiv.classList.remove('streaming');
            
        } catch (error) {
            console.error('Error fetching AI response:', error);
            if (error.name === 'AbortError') {
                aiMessageDiv.innerHTML = formatAIResponse('Request timed out. Please try a shorter message or try again later.');
            } else {
                aiMessageDiv.innerHTML = formatAIResponse('Sorry, something went wrong. Please try again.');
            }
            aiMessageDiv.classList.remove('streaming');
        } finally {
            // Stop thinking timer
            stopThinkingTimer();
            loadingIndicator.classList.add('hidden');
        }
    }

    // Simulate typing effect
    async function typeText(element, text) {
        const words = text.split(' ');
        element.textContent = '';
        
        for (let i = 0; i < words.length; i++) {
            element.textContent += (i > 0 ? ' ' : '') + words[i];
            chatLog.scrollTop = chatLog.scrollHeight;
            
            // Faster typing - show multiple words at once for longer responses
            if (words.length > 100 && i % 3 === 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
            } else if (words.length > 50 && i % 2 === 0) {
                await new Promise(resolve => setTimeout(resolve, 30));
            } else {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }
    }

    chatForm.addEventListener('submit', sendMessage);
    
    // Handle Enter and Shift+Enter in the textarea
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Shift+Enter: Allow new line (default behavior)
                return;
            } else {
                // Enter only: Send message
                e.preventDefault();
                sendMessage(e);
            }
        }
    });

    // Auto-resize textarea based on content
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        const maxHeight = 150; // Maximum height in pixels
        const newHeight = Math.min(chatInput.scrollHeight, maxHeight);
        chatInput.style.height = newHeight + 'px';
        chatInput.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden';
    });

    // Document sidebar logic
    const chaptersList = document.getElementById('chapters-list');
    const searchDocs = document.getElementById('search-docs');
    const docPreview = document.getElementById('doc-preview');
    const docTitle = document.getElementById('doc-title');
    const docContent = document.getElementById('doc-content');
    const closePreview = document.getElementById('close-preview');
    let chaptersData = [];
    let selectedChapter = null;

    // Simple Markdown parser for basic formatting
    function parseMarkdown(text) {
        return text
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/`(.*?)`/gim, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
            .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>')
            .replace(/\n/gim, '<br>');
    }

    // Show document preview
    function showDocPreview(title, content, isMarkdown = false) {
        docTitle.textContent = title;
        if (isMarkdown) {
            docContent.innerHTML = parseMarkdown(content);
        } else {
            docContent.textContent = content;
        }
        docPreview.classList.remove('hidden');
    }

    // Close document preview
    closePreview.addEventListener('click', () => {
        docPreview.classList.add('hidden');
    });

    // Fetch document content
    async function fetchDocContent(url, filename) {
        // Show loading state
        showDocPreview(filename, 'Loading document...', false);
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch document');
            const content = await response.text();
            const isMarkdown = filename.toLowerCase().endsWith('.md');
            showDocPreview(filename, content, isMarkdown);
        } catch (error) {
            console.error('Error fetching document:', error);
            showDocPreview(filename, 'Error loading document content.', false);
        }
    }

    // Recursive render for folders/files
    function renderChapters(structure, filter = '', parent = chaptersList) {
        parent.innerHTML = '';
        if (!structure || structure.length === 0) {
            parent.innerHTML = '<div style="color:#888;">No chapters found.</div>';
            return;
        }
        structure.forEach(item => {
            if (item.type === 'folder') {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'chapter-folder';
                const folderLabel = document.createElement('strong');
                folderLabel.textContent = item.name;
                folderDiv.appendChild(folderLabel);
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'chapter-children';
                folderDiv.appendChild(childrenDiv);
                folderLabel.addEventListener('click', () => {
                    folderDiv.classList.toggle('expanded');
                });
                // Recursively render children
                renderChapters(item.children, filter, childrenDiv);
                parent.appendChild(folderDiv);
            } else if (item.type === 'file') {
                if (filter && !item.name.toLowerCase().includes(filter.toLowerCase())) return;
                const chapterDiv = document.createElement('div');
                chapterDiv.className = 'chapter';
                chapterDiv.textContent = item.name;
                chapterDiv.addEventListener('click', () => {
                    if (selectedChapter) selectedChapter.classList.remove('selected');
                    chapterDiv.classList.add('selected');
                    selectedChapter = chapterDiv;
                    
                    // Check if it's a text-based file we can preview
                    const isPreviewable = item.name.toLowerCase().match(/\.(md|txt|json|js|css|html|xml|yml|yaml)$/);
                    
                    if (isPreviewable) {
                        fetchDocContent(item.url, item.name);
                    } else {
                        window.open(item.url, '_blank');
                    }
                });
                parent.appendChild(chapterDiv);
            }
        });
    }

    async function fetchChapters() {
        chaptersList.innerHTML = '<div style="color:#888;">Loading chapters...</div>';
        try {
            const res = await fetch('/.netlify/functions/list-docs');
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            chaptersData = await res.json();
            if (!chaptersData || chaptersData.length === 0) {
                chaptersList.innerHTML = '<div style="color:#888;">No chapters found.</div>';
                return;
            }
            renderChapters(chaptersData);
        } catch (err) {
            console.error('Error fetching chapters:', err);
            chaptersList.innerHTML = '<div style="color:#c00;">Error loading chapters: ' + err.message + '</div>';
        }
    }

    searchDocs.addEventListener('input', (e) => {
        const filter = e.target.value;
        renderChapters(chaptersData, filter);
    });

    fetchChapters();
});
            