export type ProviderModelInput={provider:"openai"|"anthropic"|"google"|"groq"|"xai"|"openrouter"|"opencode-zen"|"hermes"|"openai-compatible";apiKey:string;modelId:string;baseURL:string};
export function createProviderChatModel(profile:ProviderModelInput,options?:{fetchImpl?:typeof fetch}):import("ai").LanguageModel;
