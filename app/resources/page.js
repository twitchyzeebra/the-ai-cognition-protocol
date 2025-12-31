'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { convertMarkdownToPdf } from '../utils/markdownToPdf';
import './resources.css';


export default function ResourcesPage() {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedResource, setSelectedResource] = useState(null);
    const [resourceContent, setResourceContent] = useState('');
    const [loadingContent, setLoadingContent] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const contentRef = useRef(null);
    const [activeTab, setActiveTab] = useState('polished');


    useEffect(() => {
        fetchResources();
    }, []);

    const fetchResources = async () => {
        try {
            const response = await fetch('/api/learning-resources');
            const data = await response.json();
            setResources(data);
        } catch (error) {
            console.error('Failed to fetch resources:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCardClick = async (resource) => {
        setSelectedResource(resource);
        setLoadingContent(true);
        try {
            const response = await fetch(`/api/learning-resources/${encodeURIComponent(resource.slug)}`);
            const data = await response.json();
            setResourceContent(data.content);
        } catch (error) {
            console.error('Failed to fetch resource content:', error);
            setResourceContent('Failed to load resource content.');
        } finally {
            setLoadingContent(false);
        }
    };

    const closeModal = () => {
        setSelectedResource(null);
        setResourceContent('');
        setLoadingContent(false);
    };

    const downloadMarkdown = () => {
        if (!selectedResource || !resourceContent) return;

        // Remove "Polished/" or "Raw/" prefix from filename
        const filename = selectedResource.slug.split('/').pop();

        const blob = new Blob([resourceContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadPdf = async () => {
        if (!selectedResource || !resourceContent) return;

        setDownloadingPdf(true);

        try {
            // Remove "Polished/" or "Raw/" prefix from filename
            const filename = selectedResource.slug.split('/').pop();

            await convertMarkdownToPdf(
                resourceContent,
                `${filename}.pdf`
            );
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert(`Failed to generate PDF: ${error.message}`);
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleContinueChat = () => {
        if (!selectedResource) return;
        sessionStorage.setItem('continueChat', selectedResource.slug);
        window.location.href = '/';
    };

    if (loading) {
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
                    <p className="subtitle">I explore the human mind in collaboration with AI. Here you will find our creations. Some of these documents explore failure states of the human mind and edges of AI capability. They can be intense. They are not advice. I started using AI in early 2025 after a breakup to make my internal experience legible. The Flavoured System—my current AI prompt—uses multiple 'personalities' that blend as needed. Documents are split: Raw (technical analysis, personal material) and Polished (designed for accessibility).</p>
                    <div className="tabs-container">
                        <button
                            className={`tab-btn ${activeTab === 'polished' ? 'active' : ''}`}
                            onClick={() => setActiveTab('polished')}
                        >
                            📖 Somewhat Polished Documents
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
                            onClick={() => setActiveTab('raw')}
                        >
                            🔧 Raw Documents
                        </button>
                    </div>
                </div>

            </header>

            <main className="resources-main">
                <div className="cards-grid">
                    {resources.filter(resource => resource.category === activeTab).map((resource) => (
                        <div
                            key={resource.slug}
                            className="resource-card"
                            onClick={() => handleCardClick(resource)}
                        >
                            <div className="card-icon">📚</div>
                            <h3 className="card-title">{resource.title}</h3>
                            {resource.complexity && (
                                <div className={`complexity-badge ${resource.complexity}`}>
                                    {resource.complexity}
                                </div>
                            )}
                            {resource.readingTime && (
                                <div className="reading-time">
                                    {resource.readingTime} min read
                                </div>
                            )}
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
                                    onClick={downloadMarkdown}
                                    title="Download as Markdown"
                                    disabled={loadingContent}
                                >
                                    <span className="btn-icon">📄</span>
                                    <span className="btn-text">MD</span>
                                </button>
                                <button
                                    className="download-btn"
                                    onClick={downloadPdf}
                                    title="Download as PDF"
                                    disabled={loadingContent || downloadingPdf}
                                >
                                    <span className="btn-icon">📑</span>
                                    <span className="btn-text">
                                        {downloadingPdf ? 'Generating...' : 'PDF'}
                                    </span>
                                </button>
                                {selectedResource?.chattable && (
                                    <button
                                        className="download-btn chat-btn"
                                        onClick={handleContinueChat}
                                        title="Continue this conversation"
                                        disabled={loadingContent}
                                    >
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
                                <div className="markdown-content" ref={contentRef}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {resourceContent}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}