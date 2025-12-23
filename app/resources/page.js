'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './resources.css';

export default function ResourcesPage() {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedResource, setSelectedResource] = useState(null);
    const [resourceContent, setResourceContent] = useState('');

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
        try {
            const response = await fetch(`/api/learning-resources/${encodeURIComponent(resource.slug)}`);
            const data = await response.json();
            setResourceContent(data.content);
        } catch (error) {
            console.error('Failed to fetch resource content:', error);
            setResourceContent('Failed to load resource content.');
        }
    };

    const closeModal = () => {
        setSelectedResource(null);
        setResourceContent('');
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
                    <p className="subtitle">Explore metacognitive frameworks and insights</p>
                </div>
            </header>

            <main className="resources-main">
                <div className="cards-grid">
                    {resources.map((resource) => (
                        <div
                            key={resource.slug}
                            className="resource-card"
                            onClick={() => handleCardClick(resource)}
                        >
                            <div className="card-icon">📚</div>
                            <h3 className="card-title">{resource.title}</h3>
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
                            <button className="close-button" onClick={closeModal}>×</button>
                        </div>
                        <div className="modal-body">
                            <pre className="resource-text">{resourceContent}</pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}