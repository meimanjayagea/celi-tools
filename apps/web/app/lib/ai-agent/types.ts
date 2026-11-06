export type AiProvider = "openai" | "anthropic" | "google" | "groq" | "xai" | "openrouter" | "opencode-zen" | "hermes" | "openai-compatible";

export type ProviderProfile = {
  id: string;
  name: string;
  provider: AiProvider;
  modelId: string;
  baseUrl: string | null;
  isActive: boolean;
  fallbackOrder: number;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EncryptedSecret = {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
  version: 1;
};

export type StoredProfile = ProviderProfile & { secret: EncryptedSecret | null };

export type SaveProfileInput = {
  id?: string;
  name: string;
  provider: AiProvider;
  modelId: string;
  baseUrl?: string;
  apiKey?: string;
  isActive: boolean;
  fallbackOrder?: number;
};
