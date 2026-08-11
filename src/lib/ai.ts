/**
 * Ask Ventage — frontend client.
 *
 * The browser never talks to OpenAI directly. It posts to the Ventage
 * server (/api/ai/ask, proxied to :8787 in dev) with the user's Supabase
 * session token; the server verifies it, queries only the user's own data,
 * and returns a plain-text answer.
 */

import { db } from "@/lib/db/client";

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskVentageInput {
  message: string;
  itemId?: string;
  /** Recent conversation turns (session-only; not stored server-side). */
  history?: AiTurn[];
}

export interface AskVentageResult {
  answer: string;
  /** Item ids the answer references, so the UI can link to them. */
  relatedItemIds: string[];
}

export const SUGGESTED_QUESTIONS = [
  "What are my oldest unsold items?",
  "What were my most profitable sales this month?",
  "How much profit did I make this month?",
  "How much did I spend on expenses this month?",
  "Which marketplace has generated the most revenue?",
  "Which items should I consider discounting?",
  "How many items do I currently have?",
];

/** Ask the Ventage AI server a question about the signed-in user's data. */
export async function askVentage(input: AskVentageInput): Promise<AskVentageResult> {
  const client = db();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  let res: Response;
  try {
    res = await fetch("/api/ai/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: input.message,
        itemId: input.itemId,
        history: input.history ?? [],
      }),
    });
  } catch {
    throw new Error(
      "Can't reach the AI service. Make sure the Ventage server is running (npm run dev:server)."
    );
  }

  if (res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      answer?: unknown;
      relatedItemIds?: unknown;
    };
    return {
      answer: typeof body.answer === "string" ? body.answer : "",
      relatedItemIds: Array.isArray(body.relatedItemIds)
        ? body.relatedItemIds.filter((x): x is string => typeof x === "string")
        : [],
    };
  }

  let message = "Ask Ventage hit a snag. Please try again.";
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) message = body.error;
  } catch {
    // Non-JSON error body — keep the default message.
  }
  if (res.status === 401) message = "Your session has expired. Please sign in again.";
  if (res.status === 429) {
    message = "You've used your Ask Ventage requests for this hour. Try again later.";
  }
  if (res.status === 503) {
    message = "Ask Ventage isn't set up yet. Add your own OpenAI key in Settings → Ask Ventage, or ask the developer to add one.";
  }
  throw new Error(message);
}
