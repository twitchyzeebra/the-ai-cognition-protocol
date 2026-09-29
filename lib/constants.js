export const DEFAULT_SYSTEM_PROMPT = 'Prism';

// User-created system prompts live in IndexedDB; selectedSystemPrompt === `${CUSTOM_PROMPT_PREFIX}<id>` selects one.
// 'Custom Prompt' is the legacy single localStorage prompt, migrated on load.
export const CUSTOM_PROMPT_PREFIX = 'custom:';
export const LEGACY_CUSTOM_PROMPT = 'Custom Prompt';
export const customPromptKey = (id) => `${CUSTOM_PROMPT_PREFIX}${id}`;
export const isCustomPromptKey = (key) => typeof key === 'string' && key.startsWith(CUSTOM_PROMPT_PREFIX);
export const isCustomPromptSelection = (key) => key === LEGACY_CUSTOM_PROMPT || isCustomPromptKey(key);

// Model used when "Use developer key" is on (server-side ANTHROPIC_API_KEY).
export const DEV_KEY_PROVIDER = 'anthropic';
export const DEV_KEY_MODEL = 'claude-opus-5-5';

export const WEBSITE_GUIDE_SLUG = 'Polished/User Guide - Getting Started With The Chatbot';

export const DEFAULT_MODELS = {
    google: ['gemini-3-flash-preview'],
    openai: ['gpt-5.2'],
    anthropic: ['claude-fable-5-1', 'claude-opus-5', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'magistral-medium-latest', 'magistral-small-latest', 'codestral-latest'],
    glm: ['GLM-5', 'GLM-4.7-Flash', 'GLM-4.7-FlashX', 'GLM-5-Code']
};
export const PROVIDERS = Object.keys(DEFAULT_MODELS);

export const PROVIDER_LABELS = {
    google: 'Google',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    mistral: 'Mistral',
    glm: 'Z.ai (GLM)'
};
export const providerLabel = (p) => PROVIDER_LABELS[p] || p;
export const maxTemperature = (p) => (p === 'anthropic' || p === 'mistral' ? 1 : 2);

// Model capabilities, shared by the server adapters and the settings UI.
//   Anthropic: models from 4.6 onward reject sampling params (temperature) with a 400;
//              output_config.effort exists on Opus 4.5+ / Sonnet 4.6+ / Fable and 400s on older models.
//   OpenAI:    reasoning_effort exists on reasoning models only (gpt-5.x, o-series); gpt-4o etc. 400 on it.
export const anthropicSupportsSampling = (m) => !/claude-(fable|mythos|opus-5|opus-4-[678]|sonnet-5|sonnet-4-6)/i.test(m || '');
export const anthropicSupportsEffort = (m) => /claude-(fable|mythos|opus-5|opus-4-[5678]|sonnet-5|sonnet-4-6)/i.test(m || '');
export const openaiSupportsEffort = (m) => /^(gpt-5|o[1-9])/i.test(m || '');

// Reasoning effort levels per provider.
//   anthropic: output_config.effort ('high' is the API default).
//   openai:    reasoning_effort on gpt-5.x / o-series ('none' and 'xhigh' need gpt-5.1+ / gpt-5.2+).
//   glm:       reasoning_effort ('max' is the API default).
export const EFFORT_LEVELS = {
    anthropic: ['low', 'medium', 'high', 'xhigh', 'max'],
    openai: ['none', 'low', 'medium', 'high', 'xhigh'],
    glm: ['low', 'high', 'max']
};
export const DEFAULT_EFFORT = { anthropic: 'high', openai: 'medium', glm: 'max' };

export const VALIDATION_LIMITS = {
    MAX_TEXT_SIZE: 2 * 1024 * 1024,
    MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    MAX_IMAGE_BASE64: 7 * 1024 * 1024,
    MAX_PROMPT_LENGTH: 5000000,
    MAX_HISTORY_ITEMS: 500,
    MAX_HISTORY_TOTAL: 2000000,
    MAX_API_KEY_LENGTH: 500,
    MAX_IMAGES_PER_MESSAGE: 5
};

// Attachment kinds:
//   text     - read as-is in the browser
//   document - text extracted in the browser (pdf/docx/xlsx/pptx), sent as text
//   image    - base64 sent to providers that accept images
export const FILE_ATTACHMENTS = {
    TEXT_EXTENSIONS: [
        '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.log',
        '.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.java', '.c', '.h', '.cpp', '.hpp',
        '.cs', '.go', '.rs', '.php', '.sh', '.ps1', '.sql', '.rtf', '.tex'
    ],
    DOCUMENT_EXTENSIONS: ['.pdf', '.docx', '.xlsx', '.xls', '.pptx'],
    IMAGE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.webp']
};
export const ACCEPTED_FILE_EXTENSIONS = Object.values(FILE_ATTACHMENTS).flat().join(',');
