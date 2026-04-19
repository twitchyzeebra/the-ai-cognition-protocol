export const DEFAULT_SYSTEM_PROMPT = 'Prism';

export const DEFAULT_MODELS = {
    google: ['gemini-3-flash-preview'],
    openai: ['gpt-5.2'],
    anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'magistral-medium-latest', 'magistral-small-latest', 'codestral-latest'],
    glm: ['GLM-5', 'GLM-4.7-Flash', 'GLM-4.7-FlashX', 'GLM-5-Code']
};

export const VALIDATION_LIMITS = {
    MAX_TEXT_SIZE: 2 * 1024 * 1024,
    MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    MAX_IMAGE_BASE64: 7 * 1024 * 1024,
    MAX_PROMPT_LENGTH: 500000,
    MAX_HISTORY_ITEMS: 500,
    MAX_HISTORY_TOTAL: 2000000,
    MAX_API_KEY_LENGTH: 500,
    MAX_IMAGES_PER_MESSAGE: 5
};

export const FILE_ATTACHMENTS = {
    TEXT_EXTENSIONS: ['.txt', '.md'],
    IMAGE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.webp']
};