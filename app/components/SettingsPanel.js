'use client';

import { DEFAULT_MODELS } from '../../lib/constants';

/**
 * LLM settings panel with provider selection, model configuration, and API key management.
 */
export default function SettingsPanel({ llmSettings, onUpdateLlmSettings }) {
    const provider = llmSettings?.provider || 'google';
    const presets = DEFAULT_MODELS[provider] || [];
    const currentModel = llmSettings?.models?.[provider] || '';
    const isPresetSelected = presets.includes(currentModel);

    return (
        <div
            className={`history-list settings-panel ${llmSettings?.useDeveloperKey ? 'subdued' : ''}`}
            style={{ padding: '8px' }}
        >
            <label style={{ display: 'block', marginBottom: 6 }}>
                Provider
                <select
                    value={provider}
                    onChange={(e) => onUpdateLlmSettings({ provider: e.target.value })}
                    style={{ width: '100%', marginTop: 4 }}
                >
                    <option value="google">Google</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="mistral">Mistral</option>
                    <option value="glm">Z.ai</option>
                </select>
            </label>

            <label style={{ display: 'block', marginBottom: 6 }}>
                <input
                    type="checkbox"
                    className="devkey-toggle"
                    checked={!!llmSettings?.useDeveloperKey}
                    onChange={(e) => onUpdateLlmSettings({ useDeveloperKey: e.target.checked })}
                    style={{ marginRight: 8 }}
                />
                Use developer key
            </label>

            <label style={{ display: 'block', marginBottom: 6 }}>
                Preset model
                <select
                    value={isPresetSelected ? currentModel : ''}
                    onChange={(e) => onUpdateLlmSettings({
                        models: { ...(llmSettings?.models || {}), [provider]: e.target.value }
                    })}
                    style={{ width: '100%', marginTop: 4 }}
                >
                    <option value="">— Select a preset —</option>
                    {presets.map((m) => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
            </label>

            <label style={{ display: 'block', marginBottom: 6 }}>
                Temperature
                <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    className="temperature"
                    value={typeof llmSettings?.temperature === 'number' ? llmSettings.temperature : 0.7}
                    onChange={(e) => onUpdateLlmSettings({ temperature: Number(e.target.value) })}
                    placeholder="0.7"
                    style={{ width: '100%', marginTop: 4 }}
                    disabled={!!llmSettings?.useProviderDefaultTemperature}
                />
            </label>

            <label style={{ display: 'block', marginBottom: 6 }}>
                <input
                    type="checkbox"
                    className="temptoggle"
                    checked={!!llmSettings?.useProviderDefaultTemperature}
                    onChange={(e) => onUpdateLlmSettings({ useProviderDefaultTemperature: e.target.checked })}
                    style={{ marginRight: 8 }}
                />
                Use provider default temperature
            </label>

            <label style={{ display: 'block', marginBottom: 6 }}>
                Model
                <input
                    type="text"
                    value={currentModel}
                    onChange={(e) => onUpdateLlmSettings({
                        models: { ...(llmSettings?.models || {}), [provider]: e.target.value }
                    })}
                    placeholder={provider === 'google' ? 'gemini-2.5-pro' : 'e.g., gpt-4o, claude-3-5'}
                    style={{ width: '100%', marginTop: 4 }}
                />
            </label>

            <label style={{ display: 'block', marginBottom: 6 }}>
                API Key for {provider.toUpperCase()}
                <input
                    type="text"
                    autoComplete="off"
                    value={llmSettings?.apiKeys?.[provider] || ''}
                    onChange={(e) => onUpdateLlmSettings({ apiKey: e.target.value })}
                    placeholder={`Enter your ${provider} API key (kept local)`}
                    style={{
                        width: '100%',
                        marginTop: 4,
                        WebkitTextSecurity: 'disc',
                        textSecurity: 'disc'
                    }}
                />
            </label>

            {!llmSettings?.apiKeys?.[provider] && (
                <p style={{ fontSize: 12, color: '#b94a48' }}>
                    API key required for {provider}. Add your key to use this provider.
                </p>
            )}
            <p style={{ fontSize: 12, color: '#888' }}>
                Your key stays in your browser storage and is sent only with requests.
            </p>
        </div>
    );
}
