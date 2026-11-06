import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createProviderChatModel(profile,{fetchImpl=fetch}={}) {
  const shared={apiKey:profile.apiKey,baseURL:profile.baseURL,fetch:fetchImpl};
  switch(profile.provider) {
    case "openai": return createOpenAI(shared)(profile.modelId);
    case "anthropic": return createAnthropic(shared)(profile.modelId);
    case "google": return createGoogle(shared)(profile.modelId);
    case "groq":
    case "xai":
    case "openrouter":
    case "opencode-zen":
    case "hermes":
    case "openai-compatible":
      return createOpenAICompatible({name:profile.provider,...shared}).chatModel(profile.modelId);
    default: throw new Error("Provider tidak didukung.");
  }
}
