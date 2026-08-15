import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { completeEbayOAuth } from "@/lib/ebay";

/**
 * eBay's OAuth redirect target (EBAY_REDIRECT_URI, e.g. /ebay/callback).
 *
 * eBay returns the browser here with ?code=…&state=… after the user approves
 * the connection. This page exchanges the code with the server (using the
 * signed-in Supabase session) and lands back on Marketplace.
 */
export default function EbayCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      navigate("/marketplace?ebay=error&message=The+eBay+link+was+missing+its+code.", { replace: true });
      return;
    }

    completeEbayOAuth(code, state)
      .then(() => navigate("/marketplace?ebay=connected", { replace: true }))
      .catch((e) => {
        const message = e instanceof Error ? e.message : "Please try again.";
        navigate(`/marketplace?ebay=error&message=${encodeURIComponent(message)}`, { replace: true });
      });
  }, [navigate, params]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <p className="animate-pulse text-sm text-muted-foreground">Connecting your eBay account…</p>
    </div>
  );
}
