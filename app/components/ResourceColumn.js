import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ResourceColumn({ selectedResource, resourceContent, onCollapse }) {
    return (
        <div id="resource-column">
            <div className="column-header">
                <h2>Resource: {selectedResource.replace(/-/g, ' ')}</h2>
                <button className="collapse-btn" onClick={onCollapse} title="Collapse resource">×</button>
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{resourceContent}</ReactMarkdown>
        </div>
    );
}
