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
 * The configured, ready-to-use provider — or null when the chosen provider
 * isn't configured (missing API key). Null means "AI not set up yet", which
 * the endpoint reports as a friendly 503.
 */
export function getAiProvider(): AiProvider | null {
  const factory = REGISTRY[AI_PROVIDER];
  if (!factory) return null;
  const provider = factory();
  return provider.configured() ? provider : null;
}

export type { AiProvider, AiRequest, AiTurn } from "./provider.js";
