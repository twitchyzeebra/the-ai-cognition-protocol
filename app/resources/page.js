'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { convertMarkdownToPdf } from '../utils/markdownToPdf';
import { downloadText, fetchJson, resourceUrl } from '../utils/helpers';
import './resources.css';

const TABS = [['polished', '📖 Polished Documents'], ['raw', '🔧 Raw Documents'], ['human', '✍️ Raw Human Writings']];

export default function ResourcesPage() {
    const [resources, setResources] = useState(null); // null while loading
    const [activeTab, setActiveTab] = useState('polished');
    const [selectedResource, setSelectedResource] = useState(null);
    const [resourceContent, setResourceContent] = useState('');
    const [loadingContent, setLoadingContent] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const requestId = useRef(0); // ignores responses for cards that are no longer open

    useEffect(() => {
        fetchJson('/api/learning-resources')
            .then(list => setResources(Array.isArray(list) ? list : []))
            .catch(error => { console.error('Failed to fetch resources:', error); setResources([]); });
    }, []);

    const openResource = async (resource) => {
        const id = ++requestId.current;
        setSelectedResource(resource);
        setLoadingContent(true);
        let content;
        try {
            content = (await fetchJson(resourceUrl(resource.slug))).content;
        } catch (error) {
            console.error('Failed to fetch resource content:', error);
            content = 'Failed to load resource content.';
        }
        if (id !== requestId.current) return;
        setResourceContent(content);
        setLoadingContent(false);
    };

    const closeModal = () => {
        requestId.current++;
        setSelectedResource(null);
        setResourceContent('');
        setLoadingContent(false);
    };

    // Download names drop the category prefix ("Polished/Title" → "Title").
    const fileName = () => selectedResource.slug.split('/').pop();

    const downloadPdf = async () => {
        setDownloadingPdf(true);
        try {
            await convertMarkdownToPdf(resourceContent, `${fileName()}.pdf`);
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert(`Failed to generate PDF: ${error.message}`);
        } finally {
            setDownloadingPdf(false);
        }
    };

    const continueChat = () => {
        sessionStorage.setItem('continueChat', selectedResource.slug);
        window.location.href = '/';
    };

    if (!resources) {
        return (
            <div className="resources-page">
                <div className="loading">Loading resources...</div>
            </div>
        );
    }

    return (
        <div className="resources-page">
            <header className="resources-header">
                <div className="header-content">
                    <Link href="/" className="back-link">← Back to Chat</Link>
                    <h1>Learning Resources</h1>
                    <p className="subtitle">I explore the human mind in collaboration with AI. Here you will find our creations. Some of these documents explore failure states of the human mind and edges of AI capability. They can be intense. They are not advice. I started using AI in early 2025 after a breakup to make my internal experience legible. The Flavoured System—my current AI prompt—uses multiple 'personalities' that blend as needed. Documents are split: Raw (technical analysis, personal material), Polished (designed for accessibility), and Human (What I have written myself to explain things to AI).</p>
                    <div className="tabs-container">
                        {TABS.map(([tab, label]) => (
                            <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{label}</button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="resources-main">
                <div className="cards-grid">
                    {resources.filter(r => r.category === activeTab).map(resource => (
                        <div key={resource.slug} className="resource-card" onClick={() => openResource(resource)}>
                            <div className="card-icon">📚</div>
                            <h3 className="card-title">{resource.title}</h3>
                            {resource.complexity && <div className={`complexity-badge ${resource.complexity}`}>{resource.complexity}</div>}
                            {resource.readingTime && <div className="reading-time">{resource.readingTime} min read</div>}
                            <div className="card-footer">
                                <span className="click-hint">Click to read →</span>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {selectedResource && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedResource.title}</h2>
                            <div className="modal-actions">
                                <button
                                    className="download-btn"
                                    onClick={() => resourceContent && downloadText(resourceContent, `${fileName()}.md`, 'text/markdown')}
                                    title="Download as Markdown"
                                    disabled={loadingContent}
                                >
                                    <span className="btn-icon">📄</span>
                                    <span className="btn-text">MD</span>
                                </button>
                                <button
                                    className="download-btn"
                                    onClick={() => resourceContent && downloadPdf()}
                                    title="Download as PDF"
                                    disabled={loadingContent || downloadingPdf}
                                >
                                    <span className="btn-icon">📑</span>
                                    <span className="btn-text">{downloadingPdf ? 'Generating...' : 'PDF'}</span>
                                </button>
                                {selectedResource.chattable && (
                                    <button className="download-btn chat-btn" onClick={continueChat} title="Continue this conversation" disabled={loadingContent}>
                                        <span className="btn-icon">💬</span>
                                        <span className="btn-text">Continue Chat</span>
                                    </button>
                                )}
                                <button className="close-button" onClick={closeModal}>×</button>
                            </div>
                        </div>
                        <div className="modal-body">
                            {loadingContent ? (
                                <div className="content-loader">
                                    <div className="loader"></div>
                                    <p>Loading content...</p>
                                </div>
                            ) : (
                                <div className="markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{resourceContent}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
