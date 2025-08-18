// Normalized message and adapter types for provider-agnostic chat

/**
 * @typedef {Object} NormalizedMessage
 * @property {'user'|'assistant'|'system'} role
 * @property {string} content
 * @property {number} [timestamp]
 */

/**
 * @typedef {Object} SendMessageParams
 * @property {string} apiKey
 * @property {string} model
 * @property {string} prompt
 * @property {string} [systemInstruction]
 * @property {NormalizedMessage[]} history
 */

/**
 * @typedef {AsyncGenerator<string, void, unknown>} TextStream
 */

/**
 * @typedef {Object} ProviderAdapter
 * @property {(params: SendMessageParams) => TextStream} sendMessageStream
 */

export {};
