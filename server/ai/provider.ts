/**
 * AI provider plugin interface.
 *
 * The endpoint depends ONLY on this interface. Adding a new AI provider
 * (Anthropic, a local model, a future in-house service...) means dropping a
 * new implementation in server/ai/providers/ and registering it — no changes
 * to the route, the context builders, or the frontend.
 */

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiRequest {
  /** Ventage-computed context (authoritative numbers, only relevant data). */
  context: string;
  question: string;
  history?: AiTurn[];
}

export interface AiProvider {
  readonly id: string;
  /** True when this provider has the credentials it needs to run. */
  configured(): boolean;
  /** Generate an answer for a user question given Ventage-computed context. */
  generateAnswer(request: AiRequest): Promise<string>;
}
