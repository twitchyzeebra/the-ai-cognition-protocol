document.addEventListener('DOMContentLoaded', () => {
    // Chat logic
    const chatInput = document.getElementById('chat-input');
    const chatForm = document.getElementById('chat-form');
    const chatLog = document.getElementById('chat-log');
    const loadingIndicator = document.getElementById('loading-indicator');
    const thinkingTimer = document.getElementById('thinking-timer');
    
    // Sidebar elements
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Document elements
    const chaptersList = document.getElementById('chapters-list');
    const searchDocs = document.getElementById('search-docs');
    const docPreview = document.getElementById('doc-preview');
    const docTitle = document.getElementById('doc-title');
    const docContent = document.getElementById('doc-content');
    const closePreview = document.getElementById('close-preview');
    const mainContent = document.getElementById('main-content');
    
    // Settings elements
    const chatToggle = document.getElementById('chat-toggle');
    const chatSection = document.getElementById('chat-section');
    
    // Debug: Check if close button was found
    if (!closePreview) {
        console.error('Close preview button not found in DOM');
    } else {
        console.log('Close preview button found successfully');
        console.log('Close button element:', closePreview);
        console.log('Close button innerHTML:', closePreview.innerHTML);
    }
    
    // Helper function to update layout based on document preview visibility
    function updateLayout() {
        const isHidden = docPreview.classList.contains('hidden');
        console.log('Updating layout, doc preview hidden:', isHidden);
        
        if (isHidden) {
            mainContent.classList.add('doc-preview-hidden');
            console.log('Added doc-preview-hidden class');
        } else {
            mainContent.classList.remove('doc-preview-hidden');
            console.log('Removed doc-preview-hidden class');
        }
    }
    
    // Ensure document preview starts hidden
    function ensureInitialState() {
        console.log('Setting initial state - hiding document preview');
        docPreview.classList.add('hidden');
        updateLayout();
    }
    
    // Chat toggle functionality
    function toggleChat() {
        const isVisible = chatToggle.checked;
        console.log('💬 Toggling chat visibility:', isVisible);
        
        if (isVisible) {
            chatSection.classList.remove('chat-hidden');
            mainContent.classList.remove('chat-hidden');
        } else {
            chatSection.classList.add('chat-hidden');
            mainContent.classList.add('chat-hidden');
        }
        
        // Save state to localStorage
        localStorage.setItem('chatVisible', isVisible);
        updateLayout();
    }
    
    // Load saved chat state
    function loadChatState() {
        const saved = localStorage.getItem('chatVisible');
        const isVisible = saved !== null ? saved === 'true' : true; // Default to visible
        
        chatToggle.checked = isVisible;
        toggleChat();
    }
    
    let thinkingInterval = null;
    let thinkingStartTime = null;
    let selectedChapter = null;

    // Sidebar functionality
    function toggleSidebar() {
        sidebar.classList.toggle('sidebar-collapsed');
        const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
        
        // Save state to localStorage
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    }

    function switchTab(targetTab) {
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked button and corresponding content
        const clickedButton = document.querySelector(`[data-tab="${targetTab}"]`);
        const targetContent = document.getElementById(`${targetTab}-tab`);
        
        if (clickedButton && targetContent) {
            clickedButton.classList.add('active');
            targetContent.classList.add('active');
        }
    }

    // Event listeners for sidebar
    sidebarToggleBtn.addEventListener('click', toggleSidebar);

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Restore sidebar state from localStorage
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState === 'true') {
        sidebar.classList.add('sidebar-collapsed');
    }

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

    // Handle real-time streaming with Server-Sent Events (SSE)
    async function sendStreamingMessage(prompt, aiMessageDiv) {
        try {
            console.log('🚀 Starting real-time SSE chat request...');
            
            const response = await fetch('/.netlify/functions/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Server Error Response:', errorText);
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('Response body is missing');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('✅ SSE stream finished.');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); // Keep the last, possibly incomplete line

                for (const line of lines) {
                    if (line.startsWith(':keep-alive')) {
                        console.log('❤️ Received keep-alive ping.');
                        continue;
                    }

                    if (line.startsWith('data:')) {
                        const jsonString = line.substring(5).trim();
                        if (jsonString) {
                            try {
                                const data = JSON.parse(jsonString);

                                if (data.done) {
                                    // Add final metadata
                                    const metaDiv = document.createElement('div');
                                    metaDiv.className = 'response-meta';
                                    const metaText = `Generated in ${(data.duration / 1000).toFixed(1)}s • ${data.totalChunks} chunks • ${data.totalLength} characters • 🌊 Real-time stream`;
                                    metaDiv.style.color = '#2196f3';
                                    metaDiv.innerHTML = `<small>${metaText}</small>`;
                                    aiMessageDiv.appendChild(metaDiv);
                                    return; // End processing
                                }

                                if (data.text) {
                                    fullResponse += data.text;
                                    aiMessageDiv.innerHTML = formatAIResponse(fullResponse);
                                    chatLog.scrollTop = chatLog.scrollHeight;
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e, 'Raw data:', jsonString);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Real-time streaming error:', error);
            aiMessageDiv.innerHTML = formatAIResponse('Sorry, something went wrong with the real-time connection. Please try again.');
        }
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
            // Use the new real-time streaming function
            await sendStreamingMessage(prompt, aiMessageDiv);
        } catch (error) {
            console.error('❌ Top-level sendMessage error:', error);
            aiMessageDiv.innerHTML = formatAIResponse('An unexpected error occurred. Please check the console and try again.');
        } finally {
            // Clean up after streaming is complete or has failed
            aiMessageDiv.classList.remove('streaming');
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
    let chaptersData = [];

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
        updateLayout(); // Update layout when showing document
    }

    // SIMPLIFIED CLOSE BUTTON FUNCTIONALITY
    window.closeDocumentPreview = function() {
        console.log('🔴 CLOSE FUNCTION CALLED');
        docPreview.classList.add('hidden');
        updateLayout();
        console.log('✅ Document preview should now be hidden');
    };
    
    // Simple event handler
    if (closePreview) {
        console.log('📌 Setting up close button event...');
        closePreview.onclick = function() {
            console.log('🎯 CLOSE BUTTON CLICKED!');
            closeDocumentPreview();
            return false;
        };
        console.log('✅ Close button event handler attached');
    }

    // Chat toggle functionality
    if (chatToggle) {
        console.log('💬 Setting up chat toggle...');
        chatToggle.addEventListener('change', toggleChat);
        console.log('✅ Chat toggle event handler attached');
    } else {
        console.error('Chat toggle element not found!');
    }

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
    
    // Initialize proper state on page load
    setTimeout(() => {
        console.log('🚀 Initializing application state...');
        ensureInitialState();
        loadChatState(); // Load saved chat visibility state
        console.log('✅ Initial state complete');
    }, 100);
});
