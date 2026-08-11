/**
 * Ventage server.
 *
 * Local dev:  `npm run dev:server`  (http://localhost:8787; Vite proxies /api)
 * Production: `npm run build` then `npm run start` (serves dist/ + /api).
 *
 * The only secret here is OPENAI_API_KEY, read from server-side env vars.
 * Supabase access uses the user's own access token with RLS intact.
 */

import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AiRateLimitedError, AiUnavailableError } from "./ai/errors.js";
import { getAiProvider } from "./ai/index.js";
import { AuthError, userScopedClient, verifyAccessToken } from "./auth.js";
import { buildContext } from "./ai/context.js";
import { parseDateWindow } from "./ai/dates.js";
import { checkRateLimit, RateLimitError, validateQuestion } from "./ai/limits.js";
import { route } from "./ai/router.js";
import { AI_RATE_LIMIT_PER_HOUR, PORT } from "./env.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * POST /api/ai/ask
 * Body: { message: string, itemId?: string, history?: {role,content}[] }
 * Auth: Authorization: Bearer <supabase access token>
 */
app.post("/api/ai/ask", async (req, res) => {
  try {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "Sign in to use Ask Ventage." });
      return;
    }

    // 1. Verify the session — identity comes from the token, never the body.
    const user = await verifyAccessToken(token);

    // 2. Guard rails: configured, within budget, sane input.
    const provider = getAiProvider();
    if (!provider) {
      res.status(503).json({
        error: "Ask Ventage isn't set up yet. Add an AI provider API key to the server to enable it.",
      });
      return;
    }
    checkRateLimit(user.id, AI_RATE_LIMIT_PER_HOUR);

    const message = validateQuestion(req.body?.message);
    const itemId =
      typeof req.body?.itemId === "string" && req.body.itemId ? req.body.itemId : undefined;
    const history = (Array.isArray(req.body?.history) ? req.body.history : [])
      .filter(
        (h: unknown): h is { role: string; content: string } =>
          !!h &&
          typeof h === "object" &&
          ((h as { role?: string }).role === "user" || (h as { role?: string }).role === "assistant") &&
          typeof (h as { content?: string }).content === "string"
      )
      .slice(-8)
      .map((h: { role: string; content: string }) => ({
        role: h.role as "user" | "assistant",
        content: h.content.slice(0, 4000),
      }));

    // 3. Query only the user's own data (RLS via their access token).
    const client = userScopedClient(token);
    const range = parseDateWindow(message);
    const result = await buildContext(
      client,
      user.id,
      route(message, itemId),
      range ?? undefined
    );

    // Some asks are answerable by the app itself — no AI spend needed.
    if (result.askWhichItem) {
      res.json({ answer: result.askWhichItem, relatedItemIds: [] });
      return;
    }

    // 4. Send only the structured context to the AI provider and return the answer.
    const answer = await provider.generateAnswer({
      context: result.context,
      question: message,
      history,
    });
    res.json({ answer, relatedItemIds: result.relatedItemIds ?? [] });
  } catch (e) {
    if (e instanceof AuthError) {
      res.status(401).json({ error: e.message });
      return;
    }
    if (e instanceof RateLimitError) {
      res.status(429).json({ error: e.message });
      return;
    }
    if (e instanceof AiUnavailableError) {
      res.status(503).json({ error: e.message });
      return;
    }
    if (e instanceof AiRateLimitedError) {
      res.status(429).json({ error: e.message });
      return;
    }
    // Never leak SQL, stack traces, or internals to the client.
    console.error("[ask-ventage]", e instanceof Error ? e.message : "unknown error");
    res.status(500).json({
      error: "Ask Ventage hit a snag. Please try again in a moment.",
    });
  }
});

// Serve the built frontend (production) with an SPA fallback.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Ventage server listening on http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "[warn] OPENAI_API_KEY is not set — Ask Ventage will return 503 until it is."
    );
  }
});
