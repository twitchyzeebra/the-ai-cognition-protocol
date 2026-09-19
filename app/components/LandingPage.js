import Link from 'next/link';

export default function LandingPage({ promptLabel, targetLabel, learningResources, onSelectResource, onStartChat, onNewChat }) {
    return (
        <div className="landing-page-centered">
            <h1>Welcome to The AI Cognition Protocol</h1>
            <div className="landing-intro">
                <p><strong>A Framework for Your Mind. A Commitment to Your Safety.</strong></p>
                <p>This is a space for curiosity and growth. To ensure your journey is empowering, we operate on a few core beliefs.</p>
                <ul>
                    <li><strong>Growth over Grades.</strong> This is a practice, not a performance.</li>
                    <li><strong>You're in Control.</strong> Our tools are suggestions, not rules. You are the expert.</li>
                    <li><strong>Clarity is Kindness.</strong> We're transparent about our methods and the fact that self-reflection can be challenging.</li>
                </ul>
                <p><em><strong>Please Note:</strong> These tools are for educational and self-development purposes. They are not a substitute for professional therapy or medical advice. Please seek help from a qualified professional if you are in distress.</em></p>
            </div>

            <div className="landing-status">
                <span>System prompt: <strong>{promptLabel}</strong></span>
                {targetLabel && <span>Model: <strong>{targetLabel}</strong></span>}
                <span className="landing-status-hint">Change either in the sidebar.</span>
            </div>

            <div className="panel-controls">
                <button
                    onClick={() => onStartChat("Tell me about yourself and how to use you.")}
                    className="landing-option-btn primary"
                >
                    💬 Start talking with the AI
                </button>
                <button onClick={onNewChat} className="landing-option-btn">
                    ✏️ New blank chat
                </button>
                <button
                    onClick={() => {
                        const lower = (s) => (s || '').toLowerCase();
                        const res = learningResources.find(r => lower(r.slug).includes('website guide') || lower(r.title).includes('website guide'));
                        onSelectResource(res?.slug || 'Website Guide');
                    }}
                    className="landing-option-btn"
                >
                    📖 Website Guide
                </button>
                <Link href="/resources">
                    <button className="landing-option-btn">
                        📚 Learning Resources
                    </button>
                </Link>
                <Link href="/canvas">
                    <button className="landing-option-btn">
                        ⬜ Open Canvas
                    </button>
                </Link>
            </div>

            <div className="landing-options">
                <a
                    href="https://ko-fi.com/thehumanpatch"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-option-btn"
                    title="Support this project on Ko-fi"
                >
                    ☕ Support this project on Ko-fi
                </a>
            </div>
        </div>
    );
}
