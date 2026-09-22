'use client';

import { useState } from 'react';
import {
    DEFAULT_MODELS, PROVIDER_LABELS, DEV_KEY_MODEL,
    EFFORT_LEVELS, DEFAULT_EFFORT
} from '../../lib/constants';

const CUSTOM_MODEL = '__custom__';

// Anthropic models from 4.6 onward ignore temperature (the server omits it for them).
const anthropicIgnoresTemperature = (model) =>
    /claude-(fable|mythos|opus-5|opus-4-[678]|sonnet-5|sonnet-4-6)/i.test(model || '');

// Mirrors supportsEffort in lib/llm-providers/openai.js (kept local to avoid bundling the SDK client-side).
const openaiSupportsEffort = (model) => /^(gpt-5|o[1-9])/i.test(model || '');

const EFFORT_HINT = {
    anthropic: {
        low: 'Fastest, cheapest. Simple questions.',
        medium: 'Balanced for everyday chat.',
        high: 'API default. Good reasoning depth.',
        xhigh: 'Deeper reasoning; slower.',
        max: 'Maximum reasoning; slowest and most expensive.'
    },
    openai: {
        none: 'No reasoning tokens. Fastest. gpt-5.1 or newer only.',
        low: 'Light reasoning. Quick answers.',
        medium: 'Balanced for everyday chat.',
        high: 'Deeper reasoning; slower.',
        xhigh: 'Maximum reasoning; slowest. gpt-5.2 or newer only.'
    },
    glm: {
        low: 'Light thinking. Quick answers.',
        high: 'Deeper thinking; slower.',
        max: 'API default. Maximum thinking; slowest.'
    }
};

/**
 * LLM settings: developer key shortcut, provider/model, API key, effort, temperature.
 */
export default function SettingsPanel({ llmSettings, onUpdateLlmSettings }) {
    const [showKey, setShowKey] = useState(false);
    const [customModelMode, setCustomModelMode] = useState(false);

    const devKey = !!llmSettings?.useDeveloperKey;
    const provider = llmSettings?.provider || 'google';
    const presets = DEFAULT_MODELS[provider] || [];
    const currentModel = llmSettings?.models?.[provider] || '';
    const isPreset = presets.includes(currentModel);
    const usingCustomModel = customModelMode || (!!currentModel && !isPreset);
    const effectiveProvider = devKey ? 'anthropic' : provider;
    const effectiveModel = devKey ? DEV_KEY_MODEL : (currentModel || presets[0] || '');
    const effortLevels = EFFORT_LEVELS[effectiveProvider];
    const effort = llmSettings?.efforts?.[effectiveProvider] || DEFAULT_EFFORT[effectiveProvider];
    const apiKey = llmSettings?.apiKeys?.[provider] || '';

    const setModel = (value) => onUpdateLlmSettings({
        models: { ...(llmSettings?.models || {}), [provider]: value }
    });
    const setEffort = (value) => onUpdateLlmSettings({
        efforts: { ...DEFAULT_EFFORT, ...(llmSettings?.efforts || {}), [effectiveProvider]: value }
    });

    return (
        <div className="history-list settings-panel">
            <label className="settings-toggle">
                <input
                    type="checkbox"
                    className="devkey-toggle"
                    checked={devKey}
                    onChange={(e) => onUpdateLlmSettings({ useDeveloperKey: e.target.checked })}
                />
                <span>
                    <strong>Use developer key</strong>
                    <small>No setup. Uses the site's Anthropic key with <code>{DEV_KEY_MODEL}</code>.</small>
                </span>
            </label>

            <div className={`settings-group ${devKey ? 'subdued' : ''}`}>
                <div className="settings-group-title">
                    Your own key
                    {devKey && <span className="settings-note">(inactive while developer key is on)</span>}
                </div>

                <label className="settings-field">
                    <span>Provider</span>
                    <select
                        value={provider}
                        onChange={(e) => { setCustomModelMode(false); onUpdateLlmSettings({ provider: e.target.value }); }}
                    >
                        {Object.keys(DEFAULT_MODELS).map(p => (
                            <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>
                        ))}
                    </select>
                </label>

                <label className="settings-field">
                    <span>Model</span>
                    <select
                        value={usingCustomModel ? CUSTOM_MODEL : (currentModel || '')}
                        onChange={(e) => {
                            if (e.target.value === CUSTOM_MODEL) { setCustomModelMode(true); return; }
                            setCustomModelMode(false);
                            setModel(e.target.value);
                        }}
                    >
                        <option value="">Default ({presets[0]})</option>
                        {presets.map((m) => <option key={m} value={m}>{m}</option>)}
                        <option value={CUSTOM_MODEL}>Custom model ID…</option>
                    </select>
                </label>
                {usingCustomModel && (
                    <label className="settings-field">
                        <span>Custom model ID</span>
                        <input
                            type="text"
                            value={currentModel}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder={presets[0]}
                            autoFocus
                        />
                    </label>
                )}

                <label className="settings-field">
                    <span>API key for {PROVIDER_LABELS[provider] || provider}</span>
                    <span className="key-input-row">
                        <input
                            type={showKey ? 'text' : 'password'}
                            autoComplete="off"
                            spellCheck={false}
                            value={apiKey}
                            onChange={(e) => onUpdateLlmSettings({ apiKey: e.target.value })}
                            placeholder="Paste key (stored only in this browser)"
                        />
                        <button type="button" className="mini-btn" onClick={() => setShowKey(s => !s)} title={showKey ? 'Hide key' : 'Show key'}>
                            {showKey ? '🙈' : '👁️'}
                        </button>
                    </span>
                </label>
                {!devKey && !apiKey && (
                    <p className="settings-warning">Add a {PROVIDER_LABELS[provider] || provider} key, or switch on the developer key above.</p>
                )}
            </div>

            <div className="settings-group">
                <div className="settings-group-title">Generation</div>

                {effortLevels && (
                    <label className="settings-field">
                        <span>Reasoning effort</span>
                        <select value={effort} onChange={(e) => setEffort(e.target.value)}>
                            {effortLevels.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <small>{EFFORT_HINT[effectiveProvider]?.[effort]}</small>
                        {effectiveProvider === 'openai' && !openaiSupportsEffort(effectiveModel) && (
                            <small>{effectiveModel} is not a reasoning model; effort is omitted.</small>
                        )}
                    </label>
                )}

                <label className="settings-toggle compact">
                    <input
                        type="checkbox"
                        className="temptoggle"
                        checked={!!llmSettings?.useProviderDefaultTemperature}
                        onChange={(e) => onUpdateLlmSettings({ useProviderDefaultTemperature: e.target.checked })}
                    />
                    <span>Use provider default temperature</span>
                </label>
                {!llmSettings?.useProviderDefaultTemperature && (
                    <label className="settings-field">
                        <span>Temperature</span>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={effectiveProvider === 'anthropic' || effectiveProvider === 'mistral' ? 1 : 2}
                            className="temperature"
                            value={typeof llmSettings?.temperature === 'number' ? llmSettings.temperature : 0.7}
                            onChange={(e) => onUpdateLlmSettings({ temperature: Number(e.target.value) })}
                        />
                        {effectiveProvider === 'anthropic' && anthropicIgnoresTemperature(effectiveModel) && (
                            <small>{effectiveModel} does not accept temperature; it is omitted.</small>
                        )}
                    </label>
                )}
            </div>

            <p className="settings-footnote">
                Active: <strong>{PROVIDER_LABELS[effectiveProvider] || effectiveProvider}</strong> · <code>{effectiveModel}</code>
                {devKey ? ' (developer key)' : ' (your key)'}
            </p>
        </div>
    );
}
