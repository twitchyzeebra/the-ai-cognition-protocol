'use client';

import { useState } from 'react';
import {
    DEFAULT_MODELS, DEV_KEY_PROVIDER, DEV_KEY_MODEL, EFFORT_LEVELS, DEFAULT_EFFORT,
    providerLabel, maxTemperature, anthropicSupportsSampling, openaiSupportsEffort
} from '../../lib/constants';

const CUSTOM_MODEL = '__custom__';

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

/** LLM settings: developer key shortcut, provider/model, API key, effort, temperature. */
export default function SettingsPanel({ llmSettings, onUpdateLlmSettings: update }) {
    const [showKey, setShowKey] = useState(false);
    const [customModelMode, setCustomModelMode] = useState(false);

    const devKey = !!llmSettings.useDeveloperKey;
    const provider = llmSettings.provider || 'google';
    const presets = DEFAULT_MODELS[provider] || [];
    const currentModel = llmSettings.models?.[provider] || '';
    const usingCustomModel = customModelMode || (!!currentModel && !presets.includes(currentModel));
    const activeProvider = devKey ? DEV_KEY_PROVIDER : provider;
    const activeModel = devKey ? DEV_KEY_MODEL : currentModel || presets[0] || '';
    const effortLevels = EFFORT_LEVELS[activeProvider];
    const effort = llmSettings.efforts?.[activeProvider] || DEFAULT_EFFORT[activeProvider];
    const apiKey = llmSettings.apiKeys?.[provider] || '';

    const setModel = (value) => update({ models: { ...llmSettings.models, [provider]: value } });

    return (
        <div className="history-list settings-panel">
            <label className="settings-toggle">
                <input type="checkbox" className="devkey-toggle" checked={devKey} onChange={(e) => update({ useDeveloperKey: e.target.checked })} />
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
                    <select value={provider} onChange={(e) => { setCustomModelMode(false); update({ provider: e.target.value }); }}>
                        {Object.keys(DEFAULT_MODELS).map(p => <option key={p} value={p}>{providerLabel(p)}</option>)}
                    </select>
                </label>

                <label className="settings-field">
                    <span>Model</span>
                    <select
                        value={usingCustomModel ? CUSTOM_MODEL : currentModel}
                        onChange={(e) => {
                            setCustomModelMode(e.target.value === CUSTOM_MODEL);
                            if (e.target.value !== CUSTOM_MODEL) setModel(e.target.value);
                        }}
                    >
                        <option value="">Default ({presets[0]})</option>
                        {presets.map(m => <option key={m} value={m}>{m}</option>)}
                        <option value={CUSTOM_MODEL}>Custom model ID…</option>
                    </select>
                </label>
                {usingCustomModel && (
                    <label className="settings-field">
                        <span>Custom model ID</span>
                        <input type="text" value={currentModel} onChange={(e) => setModel(e.target.value)} placeholder={presets[0]} autoFocus />
                    </label>
                )}

                <label className="settings-field">
                    <span>API key for {providerLabel(provider)}</span>
                    <span className="key-input-row">
                        <input
                            type={showKey ? 'text' : 'password'}
                            autoComplete="off"
                            spellCheck={false}
                            value={apiKey}
                            onChange={(e) => update({ apiKeys: { ...llmSettings.apiKeys, [provider]: e.target.value } })}
                            placeholder="Paste key (stored only in this browser)"
                        />
                        <button type="button" className="mini-btn" onClick={() => setShowKey(s => !s)} title={showKey ? 'Hide key' : 'Show key'}>
                            {showKey ? '🙈' : '👁️'}
                        </button>
                    </span>
                </label>
                {!devKey && !apiKey && (
                    <p className="settings-warning">Add a {providerLabel(provider)} key, or switch on the developer key above.</p>
                )}
            </div>

            <div className="settings-group">
                <div className="settings-group-title">Generation</div>

                {effortLevels && (
                    <label className="settings-field">
                        <span>Reasoning effort</span>
                        <select value={effort} onChange={(e) => update({ efforts: { ...DEFAULT_EFFORT, ...llmSettings.efforts, [activeProvider]: e.target.value } })}>
                            {effortLevels.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <small>{EFFORT_HINT[activeProvider]?.[effort]}</small>
                        {activeProvider === 'openai' && !openaiSupportsEffort(activeModel) && (
                            <small>{activeModel} is not a reasoning model; effort is omitted.</small>
                        )}
                    </label>
                )}

                <label className="settings-toggle compact">
                    <input
                        type="checkbox"
                        className="temptoggle"
                        checked={!!llmSettings.useProviderDefaultTemperature}
                        onChange={(e) => update({ useProviderDefaultTemperature: e.target.checked })}
                    />
                    <span>Use provider default temperature</span>
                </label>
                {!llmSettings.useProviderDefaultTemperature && (
                    <label className="settings-field">
                        <span>Temperature</span>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={maxTemperature(activeProvider)}
                            className="temperature"
                            value={typeof llmSettings.temperature === 'number' ? llmSettings.temperature : 0.7}
                            onChange={(e) => update({ temperature: Number(e.target.value) })}
                        />
                        {activeProvider === 'anthropic' && !anthropicSupportsSampling(activeModel) && (
                            <small>{activeModel} does not accept temperature; it is omitted.</small>
                        )}
                    </label>
                )}
            </div>

            <p className="settings-footnote">
                Active: <strong>{providerLabel(activeProvider)}</strong> · <code>{activeModel}</code>
                {devKey ? ' (developer key)' : ' (your key)'}
            </p>
        </div>
    );
}
