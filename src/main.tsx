import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "@/index.css";
import App from "@/App";
import { db, isSupabaseConfigured } from "@/lib/db/client";

/**
 * Supabase puts the OAuth (Google) or recovery code in the URL when it
 * redirects back to the app. We exchange it explicitly BEFORE React renders —
 * otherwise the router's catch-all `<Navigate>` replaces the URL and the code
 * (and the session) is lost before supabase-js ever sees it.
 */
async function prepareAuth() {
  if (!isSupabaseConfigured) return;

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const hadImplicitTokens = /[#&](access_token|error)=/.test(window.location.hash);
  if (!code && !hadImplicitTokens) return;

  try {
    if (code) {
      await db().auth.exchangeCodeForSession(code);
    } else {
      // Implicit flow: let supabase-js pick the tokens out of the URL hash.
      await db().auth.getSession();
    }
  } catch (err) {
    console.error("[auth] prepareAuth failed", err);
  }

  // Tidy the address bar: drop the one-time code so it can't be reused/shared.
  const clean = new URL(window.location.href);
  clean.searchParams.delete("code");
  window.history.replaceState({}, "", clean.toString());
}

async function boot() {
  await prepareAuth();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

void boot();
