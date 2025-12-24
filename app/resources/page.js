'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

        const blob = new Blob([resourceContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedResource.slug}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadPdf = async () => {
        if (!selectedResource || !contentRef.current) return;

        setDownloadingPdf(true);

        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const element = contentRef.current;
            const opt = {
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `${selectedResource.slug}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2,
                    useCORS: true,
                    letterRendering: true
                },
                jsPDF: { 
                    unit: 'in', 
                    format: 'letter', 
                    orientation: 'portrait' 
                },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await html2pdf().set(opt).from(element).save();
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setDownloadingPdf(false);
        }
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
                    <p className="subtitle">I explore the human mind in collaboration with AI. Here you will find our creations. Proceed with caution. This isn't standard self-help. Some of these documents explore the failure states of the human mind and the edges of AI capability. They can be intense. They can be destabilizing. My current system prompt for AI - The Flavoured System - uses multiple "personalities" and blends them as necessary; most of the current documents were made with this. Who am I? I am neurodivergent. I am mildly autistic. I am a man on a journey. I started using AI at the start of 2025 after a breakup. AI has taught me how to transform what I could not explain into words, legible words! And I hope that these documents can help you do the same. While these documents are generally heavily technical, I am currently working on making more digestible and useful documents.</p>
                    <div className="tabs-container">
                         <button 
                             className={`tab-btn ${activeTab === 'polished' ? 'active' : ''}`}
                             onClick={() => setActiveTab('polished')}
                         >
                             📖 Polished Documents
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