# Contributing to AI Cognition Protocol

Thank you for your interest in contributing to the AI Cognition Protocol! This guide will help you understand how to contribute effectively to this project.

## Development Setup

Please refer to the [README.md](../README.md) and [Development Guide](../.github/copilot-instructions.md) for initial setup instructions.

## Contribution Workflow

1. **Fork the Repository**: Create your own fork of the repository
2. **Create a Feature Branch**: Work on a dedicated branch for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Implement Your Changes**: Follow the code style and architecture patterns
4. **Test Your Changes**: Ensure your changes work correctly and don't break existing functionality
5. **Create a Pull Request**: Submit your changes for review

## Types of Contributions

### Code Contributions

- **Bug Fixes**: Identify and fix issues in the existing codebase
- **Feature Additions**: Implement new functionality that enhances the application
- **Performance Improvements**: Optimize existing code for better performance
- **UI Enhancements**: Improve the user interface and experience

### Content Contributions

- **Learning Resources**: Create new educational content in the `learning-resources/` directory
- **System Prompts**: Develop new encrypted system prompts (never commit raw prompts)
- **Documentation**: Improve existing documentation or add new guides

## Code Style Guidelines

- Use consistent naming conventions:
  - camelCase for variables and functions
  - PascalCase for React components
  - kebab-case for file names
- Include comments for complex logic
- Keep components modular and focused on a single responsibility
- Follow the existing project architecture patterns
- Use descriptive variable and function names

## Pull Request Guidelines

- Provide a clear, descriptive title
- Include a detailed description of the changes
- Reference any related issues
- Keep PRs focused on a single concern
- Be responsive to feedback and review comments

## Security Considerations

- Never commit raw system prompts
- Never commit your `.env` file or any API keys
- Only commit encrypted prompt files to the repository
- Follow secure coding practices
- Avoid hardcoding sensitive information

## Learning Resource Guidelines

When creating new learning resources:

1. Use Markdown formatting
2. Include clear headings and subheadings
3. Use code examples where appropriate
4. Provide references or citations for factual claims
5. Add the resource to `learning-resources/index.md` under the appropriate category

## System Prompt Guidelines

When creating new system prompts:

1. Focus on a specific cognitive pattern or behavior
2. Use clear, unambiguous instructions
3. Test the prompt thoroughly before submitting
4. Only commit the encrypted version

## Questions?

If you have any questions about contributing, please open an issue with the label "question" and we'll be happy to help.
