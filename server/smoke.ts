/**
 * Server smoke test — no test framework, no external services.
 *
 * Starts the real Express app on an ephemeral port and checks the things
 * that don't need a Supabase project:
 *   1. /health answers 200
 *   2. /api/ai/ask rejects a missing bearer token with 401
 *   3. /api/marketplaces/ebay/status rejects a missing bearer token with 401
 *   4. /api/marketplaces/ebay/research rejects a missing bearer token with 401
 *   5. research metrics math (sell-through, median/avg, verdict thresholds)
 *
 * Run with:  npm run test:smoke
 * Exits non-zero on the first failure so CI fails loudly.
 */

import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import {
  computeResearchMetrics,
  type ResearchListing,
} from "./marketplaces/ebay/research.js";

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

    // 4. Research routes reject missing auth (research is for signed-in users).
    const research = await fetch(`${base}/api/marketplaces/ebay/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "vintage levi's 501" }),
    });
    if (research.status !== 401)
      fail(`/api/marketplaces/ebay/research without a token returned ${research.status}`);
    console.log("✓ /api/marketplaces/ebay/research without a token → 401");

    // 5. Research metrics math (pure functions — no external services).
    const listing = (price: number | null): ResearchListing => ({
      itemId: "i",
      title: "test item",
      price,
      currency: "USD",
      condition: null,
      thumbnail: null,
      url: null,
      endedAt: null,
      seller: null,
      buyingOptions: [],
    });
    const many = (prices: number[]): ResearchListing[] => prices.map(listing);
    const check = (name: string, cond: boolean) => {
      if (!cond) fail(`research metrics: ${name}`);
      console.log(`✓ research metrics: ${name}`);
    };

    // Stats: 10 sold ($1..$10) vs 40 active → 20% sell-through, median 5.5.
    const stats = computeResearchMetrics(
      "test",
      many(Array.from({ length: 40 }, (_, i) => 20 + i)),
      many([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    );
    check("sell-through = sold / (sold + active) × 100", stats.metrics.sellThroughRate === 20);
    check("average sold price", stats.metrics.avgSold === 5.5);
    check("median sold price (even count)", stats.metrics.medianSold === 5.5);
    check("min/max sold price", stats.metrics.minSold === 1 && stats.metrics.maxSold === 10);
    check("estimated market price = median sold", stats.metrics.estimatedMarketPrice === 5.5);
    check("estimated price source is sold", stats.metrics.estimatedMarketPriceSource === "sold");

    // Median for an odd count.
    const odd = computeResearchMetrics("test", many([9, 9, 9, 9, 9, 9, 9]), many([5, 10, 20]));
    check("median sold price (odd count)", odd.metrics.medianSold === 10);

    // No sold data → no sell-through, price estimate falls back to active.
    const noSold = computeResearchMetrics("test", many([10, 20, 30, 40]), []);
    check("no sold data → sell-through is null", noSold.metrics.sellThroughRate === null);
    check("no sold data → median sold is null", noSold.metrics.medianSold === null);
    check(
      "no sold data → estimate from active median",
      noSold.metrics.estimatedMarketPrice === 25 && noSold.metrics.estimatedMarketPriceSource === "active"
    );
    check("no sold data → verdict insufficient", noSold.verdict === "insufficient");

    // Verdict thresholds.
    const strong = computeResearchMetrics("test", many([1, 1, 1, 1, 1]), many([1, 1, 1, 1, 1]));
    check("5 sold + 50% sell-through → strong", strong.verdict === "strong");
    const moderate = computeResearchMetrics("test", many([1, 1, 1, 1, 1, 1, 1, 1]), many([1, 1]));
    check("2 sold + 20% sell-through → moderate", moderate.verdict === "moderate");
    const low = computeResearchMetrics("test", many([1, 1, 1, 1, 1, 1, 1, 1, 1]), many([1]));
    check("single comp → low", low.verdict === "low");
    const empty = computeResearchMetrics("test", [], []);
    check("no results → no estimate, insufficient",
      empty.metrics.estimatedMarketPrice === null && empty.verdict === "insufficient");

    console.log("All smoke tests passed.");
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.error("✗ smoke test crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
