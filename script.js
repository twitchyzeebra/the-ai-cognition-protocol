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
        messageDiv.textContent = text;
        chatLog.appendChild(messageDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    async function sendMessage(e) {
        if (e) e.preventDefault();
        const prompt = chatInput.value.trim();
        if (!prompt) return;
        addMessage(prompt, 'user-message');
        chatInput.value = '';
        
        // Start thinking timer
        loadingIndicator.classList.remove('hidden');
        startThinkingTimer();
        
        try {
            const response = await fetch('/.netlify/functions/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            addMessage(data.text, 'ai-message');
        } catch (error) {
            console.error('Error fetching AI response:', error);
            addMessage('Sorry, something went wrong. Please try again.', 'ai-message');
        } finally {
            // Stop thinking timer
            stopThinkingTimer();
            loadingIndicator.classList.add('hidden');
        }
    }

    chatForm.addEventListener('submit', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            sendMessage(e);
        }
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
                chaptersList.innerHTML = '<div style="color:#c00;">Error loading chapters.</div>';
                return;
            }
            chaptersData = await res.json();
            renderChapters(chaptersData);
        } catch (err) {
            chaptersList.innerHTML = '<div style="color:#c00;">Error loading chapters.</div>';
        }
    }

    searchDocs.addEventListener('input', (e) => {
        const filter = e.target.value;
        renderChapters(chaptersData, filter);
    });

    fetchChapters();
});
            