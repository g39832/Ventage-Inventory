/**
 * Server smoke test — no test framework, no external services.
 *
 * Starts the real Express app on an ephemeral port and checks the three
 * things that don't need a Supabase project:
 *   1. /health answers 200
 *   2. /api/ai/ask rejects a missing bearer token with 401
 *   3. /api/marketplaces/ebay/status rejects a missing bearer token with 401
 *
 * Run with:  npm run test:smoke
 * Exits non-zero on the first failure so CI fails loudly.
 */

import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Health.
    const health = await fetch(`${base}/health`);
    if (health.status !== 200) fail(`/health returned ${health.status}`);
    const healthBody = (await health.json()) as { ok?: boolean };
    if (healthBody.ok !== true) fail(`/health body was ${JSON.stringify(healthBody)}`);
    console.log("✓ /health → 200 { ok: true }");

    // 2. AI rejects missing auth (never touches Supabase/OpenAI).
    const ai = await fetch(`${base}/api/ai/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    if (ai.status !== 401) fail(`/api/ai/ask without a token returned ${ai.status}`);
    console.log("✓ /api/ai/ask without a token → 401");

    // 3. eBay routes reject missing auth.
    const ebay = await fetch(`${base}/api/marketplaces/ebay/status`);
    if (ebay.status !== 401) fail(`/api/marketplaces/ebay/status without a token returned ${ebay.status}`);
    console.log("✓ /api/marketplaces/ebay/status without a token → 401");

    console.log("All smoke tests passed.");
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.error("✗ smoke test crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
