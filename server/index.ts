/**
 * Threadly server entrypoint.
 *
 * Local dev:  `npm run dev:server`  (http://localhost:8787; Vite proxies /api)
 * Production: `npm run build` then `npm run start` (serves dist/ + /api).
 *
 * The Express app lives in ./app.ts so tests can build it without listening.
 */

import { createApp } from "./app.js";
import { PORT } from "./env.js";

const app = createApp();

app.listen(PORT, () => {
  console.log(`Threadly server listening on http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "[warn] OPENAI_API_KEY is not set — Ask Threadly will return 503 until it is."
    );
  }
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.warn(
      "[warn] eBay keys are not set — marketplace connections will show \"eBay not configured\" until EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are added (see EBAY_SETUP.md)."
    );
  }
});
