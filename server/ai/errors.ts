/** Thrown when the AI service isn't configured (missing / invalid credentials). */
export class AiUnavailableError extends Error {}

/** Thrown when the AI provider is rate-limiting requests. */
export class AiRateLimitedError extends Error {}
