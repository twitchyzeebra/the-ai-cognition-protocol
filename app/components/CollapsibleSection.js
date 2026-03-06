'use client';

/**
 * Reusable collapsible section with header, optional count badge, and expandable content.
 * Used for Chat History, Learning Resources, System Prompts, and Settings sections.
 */
export default function CollapsibleSection({
    title,
    isVisible,
    onToggle,
    count = null,
    children
}) {
    return (
        <div className="collapsible-section">
            <h2
                onClick={onToggle}
                className="section-header"
                role="button"
                aria-expanded={isVisible}
            >
                <span>{title}</span>
                <span className="section-meta">
                    {count !== null && (
                        <span className="count-badge" aria-label={`${count} items`}>
                            {count}
                        </span>
                    )}
                    <span className="chevron" aria-hidden>
                        {isVisible ? '▼' : '►'}
                    </span>
                </span>
            </h2>
            {isVisible && children}
        </div>
    );
}
