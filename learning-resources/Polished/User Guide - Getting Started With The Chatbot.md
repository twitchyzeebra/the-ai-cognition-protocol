# Welcome to the AI Cognition Protocol

This guide will help you get started with the application and understand its core features.

## 🚀 Getting Started: Setting Up Your API Key

To communicate with the AI models, the application needs an API key. You have two options:

#### Using the Provided Key (For Testing Only)

By default, a temporary testing key for the Antropic Models, currently set to opus 4.6. Please be aware that this key is for initial trials and is provided at my own cost. A subscription based model will be introduced when/if this gets popular, featuring a free tier. At this point, I highly recommend using your own key which will always be supported.

#### Using Your Own API Key (Recommended)

You can bring your own key from a supported AI provider. This gives you direct control over your usage and access to different models.

1.  **Obtain a key from one of the following providers:**
    *   **Google Gemini:**
        *   Get your key at: **[aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)**
        *   *(As of 21 Feb 26, gemini-3-flash-preview is free to use with 20 uses per day.)*
    *   **Mistral AI:**
        *   Get your key at: **[admin.mistral.ai/organization/api-keys](https://admin.mistral.ai/organization/api-keys)**
        *   *(Mistral offers cheap and decently capable models. They used to have a free tier, I am unsure if that still exists)*
    *   **Anthropic/Claude AI: What I Use**
        *   Get your key at: **[platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)**
        *   *(Costs $5.5 US dollars to obtain a key. This gives you $5 US of credit to use. Currently this is the most recommended pathway as it gives you access to opus 4.6, a very powerful model.)*
    *   **Z.ai:**
        *   Get your key at: **[z.ai/manage-apikey/apikey-list](https://z.ai/manage-apikey/apikey-list)**
        *   *(As of 21 Feb 26, GLM-4.7-Flash is free to use, its typically slow to respond and has rate limits.)*

2.  **Configure your key in the application's sidebar.** Once you have your key, open the settings panel in the sidebar to enter it and select your desired model.

## 🧠 Understanding the AI System Prompts

This application allows you to choose from several distinct AI system prompts, each designed for a different type of analysis. Many of my old system prompts are listed which have not been updated in awhile. Emergent Flavor System is the current default and the recommended system prompt to use. 

*   **Emergent Flavor System**
    *   Combines several system prompts into one using a "Flavor" system. It includes Dream, Syllogist, Socratic, Adversarial, Interpersonal, Efficient, Apopthatic, Pattern, Reality and Mirror. The AI will adapt based on your input, you can also explicitly request by using @Dream etc. Anti-Flavors and null flavors can also be specificied, such as @Anti_Dream and @Non_Adversarial. Complex application of flavours is possible, the AI will typically select 2 or 3 flavors, and there is a few defined multi-flavor combinations that have unique uses such as Exorcist.

*   **Inference Engine**
    *   Designed to minimize hallucinations. Very experiemental.

*   **Generic System**
    *   Specifically designed to remove my grievences with the default gemini 3.0 pro model. The bulk of it was written in 2 minutes off the top of my head.

*   **The Pander Machine**
    *   A slight edit of the Generic System, with "CRITICAL: Now take all of this and do the ANTI of it" added at the end.

## Legacy and fundational system prompts

*   **Cognitive Tiers**
    *   This focuses on analyzing a situation through distinct "Tiers of Cognition" - from raw, uninterpreted data (T1) all the way to deep, synthesized insights (T5). It provides a layered breakdown of the thinking process. This has been used in Socratic, Adversarial and Interpersonal flavours.

*   **Dream**
    *   A turn away from logical structure. Coerces the AI to release its "grip".

*   **Socratic**
    *   An alternative approach that is less structured than the cognitive tiers. It is a short list of rules that the AI follows. It has an integrated creative mode that is triggered by prefixing your prompt with an asterisk (*). 

*   **Adversarial**
    *   Uses an edited version of the cognitive tiers. Designed to show the flaws in given systems.

*   **Hydra**
    *   A very alternative approach that combines operational modes and cognitive tiers. Trauma and personal mastery informed.    

*   **Syllogist**
    *   Reasoning through syllogisms. An "organic" take on socratic logic.

## 🔒 Privacy and Data Management

Your privacy and data control are paramount.

*   **Serverless Architecture:** Your prompts are sent directly from your browser to the AI provider you select (e.g., Google or Anthropic). No intermediate server logs or stores your conversations.
*   **Local Storage:** All your chat history and settings are stored exclusively on your own computer.
*   **Full Control:** You can permanently delete all your locally stored data at any time using the `Reset Application State` button in the sidebar.
*   **Portability:** You can easily back up your conversations by downloading them, or import previous chats from a file.

## 🤝 Connect & Support

*   **View the Source Code on GitHub:** You can inspect the code or report issues at our GitHub repository:
    *   **[github.com/twitchyzeebra/the-ai-cognition-protocol](https://github.com/twitchyzeebra/the-ai-cognition-protocol/tree/master)**

*   **Support the Project:** If you find this tool valuable, please consider supporting its ongoing development:
    *   **[ko-fi.com/thehumanpatch](https://ko-fi.com/thehumanpatch)**
