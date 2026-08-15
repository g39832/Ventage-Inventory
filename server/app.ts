/**
 * Threadly Express app (routes only — no `listen`).
 *
 * Separated from index.ts so tests (server/smoke.ts) can build the app
 * and serve it on an ephemeral port without opening the real listener.
 */

import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AiRateLimitedError, AiUnavailableError } from "./ai/errors.js";
import { createAiProvider } from "./ai/index.js";
import { AuthError, userScopedClient, verifyAccessToken } from "./auth.js";
import { buildContext } from "./ai/context.js";
import { ebayRouter } from "./marketplaces/ebay/router.js";
import { parseDateWindow } from "./ai/dates.js";
import { checkGlobalRateLimit, checkRateLimit, RateLimitError, validateQuestion } from "./ai/limits.js";
import { route } from "./ai/router.js";
import {
  AI_RATE_LIMIT_GLOBAL_PER_HOUR,
  AI_RATE_LIMIT_PER_HOUR,
  CORS_ORIGINS,
  OPENAI_API_KEY,
} from "./env.js";

export function createApp() {
  const app = express();
  // CORS is locked to the app's own origins. Requests without an Origin
  // header (same-origin, server-to-server) are always allowed; browsers from
  // any other origin get no CORS headers and are blocked by the browser.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || CORS_ORIGINS.includes(origin)) callback(null, true);
        else callback(null, false);
      },
    })
  );
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Real marketplace integrations. eBay is the only channel with a public
  // API for third-party selling; the rest stay manual (see the Marketplace
  // page). Endpoints under /api/marketplaces/ebay/* are Bearer-authenticated.
  app.use("/api/marketplaces/ebay", ebayRouter);

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
        res.status(401).json({ error: "Sign in to use Ask Threadly." });
        return;
      }

      // 1. Verify the session — identity comes from the token, never the body.
      const user = await verifyAccessToken(token);

      // 2. The user's own data client (RLS via their access token).
      const client = userScopedClient(token);

      // 3. Resolve AI credentials: the user's own key from Settings → AI wins
      //    (read from their own app_settings row, so RLS scopes it), else the
      //    server-wide OPENAI_API_KEY. Never trust a key from the request body.
      const { data: aiSettings } = await client
        .from("app_settings")
        .select("ai")
        .eq("owner_id", user.id)
        .maybeSingle();
      const userKey =
        typeof aiSettings?.ai?.openaiKey === "string" ? aiSettings.ai.openaiKey.trim() : "";
      const apiKey = userKey || OPENAI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error:
            "Ask Threadly isn't set up yet. Add your own OpenAI key in Settings → AI, or ask the app owner to configure one.",
        });
        return;
      }

      // 4. Guard rails: provider, budget, sane input.
      const provider = createAiProvider();
      if (!provider) {
        res.status(503).json({
          error: "The AI provider isn't configured on the server.",
        });
        return;
      }
      checkRateLimit(user.id, AI_RATE_LIMIT_PER_HOUR);
      checkGlobalRateLimit(AI_RATE_LIMIT_GLOBAL_PER_HOUR);

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

      // 5. Query only the user's own data (RLS via their access token).
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

      // 6. Send only the structured context to the AI provider and return the answer.
      const answer = await provider.generateAnswer({
        context: result.context,
        question: message,
        history,
        apiKey,
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
      console.error("[ask-threadly]", e instanceof Error ? e.message : "unknown error");
      res.status(500).json({
        error: "Ask Threadly hit a snag. Please try again in a moment.",
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

  return app;
}
