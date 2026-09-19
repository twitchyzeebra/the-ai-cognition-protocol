export const DEFAULT_SYSTEM_PROMPT = 'Prism';

// Prefix used for user-created system prompts stored in IndexedDB.
// selectedSystemPrompt === `${CUSTOM_PROMPT_PREFIX}<id>` selects that prompt.
export const CUSTOM_PROMPT_PREFIX = 'custom:';

// Model used when "Use developer key" is on (server-side ANTHROPIC_API_KEY).
export const DEV_KEY_PROVIDER = 'anthropic';
export const DEV_KEY_MODEL = 'claude-fable-5-1';

export const DEFAULT_MODELS = {
    google: ['gemini-3-flash-preview'],
    openai: ['gpt-5.2'],
    anthropic: ['claude-fable-5-1', 'claude-opus-5', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'magistral-medium-latest', 'magistral-small-latest', 'codestral-latest'],
    glm: ['GLM-5', 'GLM-4.7-Flash', 'GLM-4.7-FlashX', 'GLM-5-Code']
};

export const PROVIDER_LABELS = {
    google: 'Google',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    mistral: 'Mistral',
    glm: 'Z.ai (GLM)'
};

// Anthropic effort levels (output_config.effort). 'high' is the API default.
export const ANTHROPIC_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const DEFAULT_ANTHROPIC_EFFORT = 'high';

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

export const ACCEPTED_FILE_EXTENSIONS = [
    ...FILE_ATTACHMENTS.TEXT_EXTENSIONS,
    ...FILE_ATTACHMENTS.DOCUMENT_EXTENSIONS,
    ...FILE_ATTACHMENTS.IMAGE_EXTENSIONS
].join(',');
