# Welcome to the AI Cognition Protocol

This guide will help you get started with the application and understand its core features.

## 🚀 Getting Started: Setting Up Your API Key

To communicate with the AI models, the application needs an API key. You have two options:

#### Using the Provided Key (For Testing Only)

By default, a temporary testing key for the Mistral medium model is provided. Please be aware that this key is for initial trials and is provided at my own cost. A subscription based model will be introduced when/if this gets popular, featuring a free tier. At this point, I highly recommend using your own key which will always be supported.

#### Using Your Own API Key (Recommended)

You can bring your own key from a supported AI provider (Other providers coming soon™). This gives you direct control over your usage and access to different models.

1.  **Obtain a key from one of the following providers:**
    *   **Google Gemini:**
        *   Get your key at: **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**
        *   *(As of 19/08/25, Google provides a generous free tier for the Gemini 2.5 Pro model with a Google account.)*
    *   **Mistral AI:**
        *   Get your key at: **[console.mistral.ai/api-keys](https://console.mistral.ai/api-keys)**
        *   *(As of 19/08/25, Mistral offers a free key with a very generous usage allowance with an account. This is subject to model wide limits which seems to affect their medium model heavily.)*

2.  **Configure your key in the application's sidebar.** Once you have your key, open the settings panel in the sidebar to enter it and select your desired model.

## 🧠 Understanding the AI System Prompts

This application allows you to choose from several distinct AI system prompts, each designed for a different type of analysis.

*   **Cognitive Tiers**
    *   This focuses on analyzing a situation through distinct "Tiers of Cognition"—from raw, uninterpreted data (T1) all the way to deep, synthesized insights (T5). It provides a layered breakdown of the thinking process.

*   **Cognitive Tiers With Delivery**
    *   Takes the cognitive tiers analysis and translates it into a more human-friendly format. This is the default system prompt.

*   **Cognitive Tiers Technical**
    *   A more formal and technical cognitive tiers analysis. Designed for professionals and advanced users who want a more comphrehensive response.

*   **Socratic Lens**
    *   An alternative approach that is less structured than the cognitive tiers. It is a short list of rules that the AI follows. It has an integrated creative mode that is triggered by prefixing your prompt with an asterisk (*). Ask the AI about the parameters it uses.

*   **Interactive Story Detective**
    *   A user guided narrative, to initiate interaction just type 'start'.

*   **Classic AI**
    *   A standard, helpful AI assistant without any specialized cognitive framework. This is useful as a baseline for comparison. 

*   **Modes and Variants**
    *   Previously created documents that have the major issue of being too wordy (2200 tokens for Modes v2 to 9000 for Modes Technical v2). They are retained for reference.

## 🔒 Privacy and Data Management

Your privacy and data control are paramount.

*   **Serverless Architecture:** Your prompts are sent directly from your browser to the AI provider you select (e.g., Google or Mistral). No intermediate server logs or stores your conversations.
*   **Local Storage:** All your chat history and settings are stored exclusively on your own computer in your local storage.
*   **Full Control:** You can permanently delete all your locally stored data at any time using the `Reset Application State` button in the sidebar.
*   **Portability:** You can easily back up your conversations by downloading them, or import previous chats from a file.

## 🤝 Connect & Support

*   **View the Source Code on GitHub:** You can inspect the code or report issues at our GitHub repository:
    *   **[github.com/twitchyzeebra/the-ai-cognition-protocol](https://github.com/twitchyzeebra/the-ai-cognition-protocol/tree/master)**

*   **Support the Project:** If you find this tool valuable, please consider supporting its ongoing development:
    *   **[ko-fi.com/cognitivearchitect](https://ko-fi.com/cognitivearchitect)**
