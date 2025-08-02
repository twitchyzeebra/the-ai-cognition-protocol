# AI Cognition Protocol

A Next.js application implementing a chat interface using the Google Gemini API with encrypted system prompts. This project serves as both a functional AI chat interface and an educational platform for understanding AI cognition concepts.

## Features

- **Interactive Chat Interface**: Real-time conversation with AI powered by Google Gemini
- **System Prompt Selection**: Choose from multiple system prompts to guide AI behavior
- **Encrypted Prompts**: AES-256-GCM encryption for secure system prompt storage
- **Learning Resources**: Educational content about AI cognition concepts
- **State Persistence**: Complete UI state cached between sessions
- **Markdown Rendering**: Rich text formatting for AI responses and learning content
- **Streaming Responses**: Real-time display of AI responses using server-sent events

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm 8 or higher
- Google Gemini API key (get one from [Google AI Studio](https://ai.google.dev/))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/the-ai-cognition-protocol.git
   cd the-ai-cognition-protocol
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
4. Generate an encryption key:
   ```bash
   node encrypt-prompt.js generate-key
   ```

5. Edit your `.env` file to add:
   - Your Gemini API key
   - The generated encryption key

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## System Prompt Management

The project uses encrypted system prompts for security:

1. Create a text file in `SystemPrompts/Raw/<prompt-name>.txt`
2. Encrypt it: `node encrypt-prompt.js encrypt <prompt-name>`
3. The encrypted file is saved to `SystemPrompts/Encrypted/<prompt-name>.json`

Only commit encrypted prompts to version control, never raw prompts.

## Learning Resources

Educational content is stored as markdown files in the `learning-resources/` directory. Browse the `learning-resources/index.md` file for a structured overview of available content.

## Development

For detailed development instructions, see the [Development Guide](/.github/copilot-instructions.md).

## Technology Stack

- Next.js 15
- React 19
- Google Generative AI SDK
- Node.js Crypto for AES-256-GCM encryption
- ReactMarkdown with remark-gfm

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Acknowledgments

- Google Generative AI for providing the Gemini API
- The Next.js team for their excellent React framework
- The open-source community for various libraries used in this project
