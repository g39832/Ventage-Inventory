/**
 * AI provider registry — the "plugin" slot.
 *
 * Pick a provider with AI_PROVIDER (default "openai"). To add another,
 * implement AiProvider in server/ai/providers/ and register it below.
 */

import { AI_PROVIDER } from "../env.js";
import { OpenAIProvider } from "./providers/openai.js";
import type { AiProvider } from "./provider.js";

const REGISTRY: Record<string, () => AiProvider> = {
  openai: () => new OpenAIProvider(),
};

/**
 * Create the provider for the selected AI_PROVIDER — regardless of whether
 * it has credentials. With bring-your-own-key, a user's own key (Settings →
 * AI) can satisfy the provider even when the server env key is absent, so
 * the endpoint decides on credentials itself.
 */
export function createAiProvider(): AiProvider | null {
  const factory = REGISTRY[AI_PROVIDER];
  return factory ? factory() : null;
}

/**
 * The provider, only when the server-wide env key is configured. Kept for
 * callers that don't have a per-user key to fall back on.
 */
export function getAiProvider(): AiProvider | null {
  const provider = createAiProvider();
  return provider && provider.configured() ? provider : null;
}

export type { AiProvider, AiRequest, AiTurn } from "./provider.js";
