import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  Check,
  ExternalLink,
  History,
  Info,
  Loader2,
  PlusCircle,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ItemImage } from "@/components/common/ItemImage";
import { ebayStatus } from "@/lib/ebay";
import {
  deleteResearch,
  researchHistory,
  searchResearch,
  type ResearchListing,
  type ResearchMetrics,
  type ResearchResult,
  type ResearchVerdict,
  type SavedResearch,
} from "@/lib/research";
import { formatShortDate } from "@/lib/format";
import { usd, percent } from "@/lib/format";
import { dec, round2, toNum } from "@/lib/money";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EXAMPLES = [
  "Vintage Levi's 501 34x32",
  "1990s Nike hoodie",
  "Vintage Carhartt jacket",
  "Y2K graphic tee",
];

const VERDICT_VARIANT: Record<ResearchVerdict, "success" | "warning" | "muted" | "info"> = {
  strong: "success",
  moderate: "warning",
  low: "muted",
  insufficient: "info",
};

/* ── Small presentational pieces ─────────────────────────────── */

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-secondary/40 px-3.5 py-3">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg leading-none font-semibold tracking-tight tabular">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ListingRow({ listing, sold }: { listing: ResearchListing; sold: boolean }) {
  const price = listing.price !== null ? usd(listing.price) : "—";
  return (
    <li className="flex items-start gap-3 py-3">
      <ItemImage
        src={listing.thumbnail ?? ""}
        alt={listing.title}
        name={listing.title}
        className="size-14 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13.5px] leading-snug font-medium">
          {listing.title || "Untitled listing"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground tabular">{price}</span>
          {sold && listing.endedAt && (
            <span className="inline-flex items-center gap-1">
              <span className="size-1 rounded-full bg-success" />
              Sold {formatShortDate(listing.endedAt)}
            </span>
          )}
          {!sold && (
            <span className="inline-flex items-center gap-1">
              <span className="size-1 rounded-full bg-info" />
              Asking price
            </span>
          )}
          {listing.condition && <span>· {listing.condition}</span>}
          {listing.seller && <span className="hidden sm:inline">· {listing.seller}</span>}
        </div>
      </div>
      {listing.url ? (
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Open listing on eBay"
        >
          <ExternalLink className="size-4" />
        </a>
      ) : (
        <span className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground/40">
          <ExternalLink className="size-4" />
        </span>
      )}
    </li>
  );
}

/* ── The page ────────────────────────────────────────────────── */

export default function Research() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");
  const [ebayConfigured, setEbayConfigured] = useState<boolean | null>(null);
  const [history, setHistory] = useState<SavedResearch[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Purchase calculator inputs (strings so the user can clear them).
  const [purchase, setPurchase] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [shipping, setShipping] = useState("");
  const [fees, setFees] = useState("");
  const [otherCosts, setOtherCosts] = useState("");

  const loadHistory = useCallback(() => {
    researchHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    ebayStatus()
      .then((s) => setEbayConfigured(s.configured))
      .catch(() => setEbayConfigured(true)); // Unknown — don't block the UI.
    loadHistory();
  }, [loadHistory]);

  const runSearch = useCallback(
    async (raw: string, save = false) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setStatus("error");
        setError("Enter something to search for.");
        return;
      }
      setStatus("loading");
      setError("");
      try {
        const { result: res, saved } = await searchResearch(trimmed, save);
        setResult(res);
        setSavedId(saved?.id ?? null);
        setStatus("success");
        // Prefill the calculator with the best price estimate we have.
        if (res.metrics.estimatedMarketPrice !== null) {
          setSalePrice(String(res.metrics.estimatedMarketPrice));
        }
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    },
    []
  );

  const saveCurrent = async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      const { saved } = await searchResearch(result.query, true);
      if (saved) {
        setSavedId(saved.id);
        setHistory((prev) => [
          { id: saved.id, query: result.query, searchedAt: saved.searchedAt, result },
          ...prev.filter((h) => h.id !== saved.id),
        ]);
        toast("Research saved", { description: "Added to your research history." });
      }
    } catch (e) {
      toast.error("Couldn't save the research", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeHistory = async (id: string) => {
    try {
      await deleteResearch(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (savedId === id) setSavedId(null);
      toast("Removed", { description: "Research removed from history." });
    } catch {
      toast.error("Couldn't remove the research", { description: "Please try again." });
    }
  };

  const addToInventory = () => {
    if (!result) return;
    const params = new URLSearchParams({ name: result.query });
    if (result.metrics.estimatedMarketPrice !== null) {
      params.set("listingPrice", String(result.metrics.estimatedMarketPrice));
    }
    navigate(`/inventory/new?${params.toString()}`);
  };

  // ── Calculator math (decimal.js, never AI) ────────────────────
  const calc = useMemo(() => {
    const p = dec(purchase || "0");
    const s = dec(salePrice || "0");
    const sh = dec(shipping || "0");
    const f = dec(fees || "0");
    const o = dec(otherCosts || "0");
    const costs = p.plus(sh).plus(f).plus(o);
    const profit = s.minus(costs);
    const roi = costs.gt(0) ? profit.div(costs).times(100) : dec(0);
    return {
      revenue: round2(s),
      costs: round2(costs),
      profit: round2(profit),
      roi: toNum(round2(roi)),
      ready: s.gt(0),
    };
  }, [purchase, salePrice, shipping, fees, otherCosts]);

  const metrics: ResearchMetrics | null = result?.metrics ?? null;
  const showSold = (metrics?.soldCount ?? 0) > 0;
  const showActive = (metrics?.activeCount ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Research an Item"
        description="See what similar items are selling for before you buy."
        crumbs={[{ label: "Research" }]}
      />

      {/* Setup status */}
      {ebayConfigured === false && (
        <Card className="mb-6 border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3">
            <Info className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="text-[13.5px] leading-relaxed text-foreground/85">
              <p className="font-semibold">eBay research isn't configured yet</p>
              <p className="mt-1 text-muted-foreground">
                The app owner needs to add eBay developer keys (EBAY_CLIENT_ID,
                EBAY_CLIENT_SECRET) to the server first — see EBAY_SETUP.md. Until then,
                research can't reach eBay's official API.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch(query);
                }}
                placeholder="Search an item..."
                className="h-11 pl-9 text-[15px]"
                disabled={status === "loading"}
                maxLength={200}
                aria-label="Search an item"
              />
            </div>
            <Button
              size="lg"
              className="h-11 shrink-0"
              disabled={status === "loading" || !query.trim()}
              onClick={() => void runSearch(query)}
            >
              {status === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {status === "loading" ? "Searching…" : "Search"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuery(ex);
                  void runSearch(ex);
                }}
                className="rounded-full border bg-secondary/50 px-3 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {status === "error" && (
        <Card className="mt-6 border-destructive/30 bg-destructive/5">
          <CardContent className="text-[13.5px] leading-relaxed text-foreground/85">
            <p className="font-semibold text-destructive">Search didn't go through</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeletons */}
      {status === "loading" && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}

      {/* Idle empty state */}
      {status === "idle" && (
        <EmptyState
          className="mt-6"
          icon={<TrendingUp className="size-5" />}
          title="Research before you buy"
          description="Search an item you're thinking about picking up — Regroove pulls live active listings and recent sold comps from eBay's official API, then shows you what it's really worth."
        />
      )}

      {/* Results */}
      {status === "success" && result && metrics &&
        (metrics.activeCount === 0 && metrics.soldCount === 0 ? (
          <div className="mt-6">
            <Card>
              <EmptyState
                icon={<Search className="size-5" />}
                title="No listings found"
                description={`eBay's API returned no active or sold listings for “${result.query}”. Try a broader search or a different way of describing the item.`}
              />
            </Card>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Verdict */}
          <Card className="border-primary/20">
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={VERDICT_VARIANT[result.verdict]} className="px-2.5 py-1 text-[13px]">
                  {result.verdict === "strong" && <TrendingUp className="size-3.5" />}
                  {result.verdictLabel}
                </Badge>
                <span className="text-[12.5px] text-muted-foreground">
                  {result.verdict === "insufficient"
                    ? "No sold comps found — here's what the market shows."
                    : "Based on the available eBay data, this item appears to have resale potential."}
                </span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-foreground/85">
                {result.verdictSentence}
              </p>
              <p className="text-[12px] text-muted-foreground">
                Estimate, not a guarantee — the decision is yours.{" "}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                    >
                      How this is calculated
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1.5">
                      <p>
                        <span className="font-semibold">Sell-through rate</span> = sold ÷ (sold
                        + active) × 100 — how often comparable listings turn over. Strong ≥ 50%
                        with 5+ sold comps, moderate ≥ 20% with 2+, otherwise low.
                      </p>
                      <p>
                        Sold stats come only from ended-with-sales listings; active stats are
                        asking prices and are never mixed in.
                      </p>
                      <p>
                        Metrics use the first 50 active + 50 sold results eBay returned.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </p>
            </CardContent>
          </Card>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MetricCard label="Active listings" value={String(metrics.activeCount)} />
            <MetricCard label="Sold listings" value={String(metrics.soldCount)} />
            {metrics.sellThroughRate !== null && (
              <MetricCard
                label="Sell-through rate"
                value={percent(metrics.sellThroughRate / 100)}
                hint="sold ÷ (sold + active)"
              />
            )}
            {metrics.estimatedMarketPrice !== null && (
              <MetricCard
                label="Estimated market price"
                value={usd(metrics.estimatedMarketPrice)}
                hint={metrics.estimatedMarketPriceSource === "sold" ? "median sold price" : "median asking price"}
              />
            )}
            {showSold && metrics.avgSold !== null && (
              <MetricCard label="Average sold price" value={usd(metrics.avgSold)} />
            )}
            {showSold && metrics.medianSold !== null && (
              <MetricCard label="Median sold price" value={usd(metrics.medianSold)} />
            )}
            {showSold && metrics.minSold !== null && metrics.maxSold !== null && (
              <MetricCard
                label="Sold price range"
                value={`${usd(metrics.minSold)} – ${usd(metrics.maxSold)}`}
              />
            )}
            {showActive && metrics.avgActive !== null && (
              <MetricCard
                label="Average asking price"
                value={usd(metrics.avgActive)}
                hint="active listings — asking, not sold"
              />
            )}
          </div>

          {!showSold && (
            <Card className="border-info/30 bg-info/5">
              <CardContent className="flex items-start gap-3">
                <Info className="mt-0.5 size-4 shrink-0 text-info" />
                <p className="text-[13px] leading-relaxed text-foreground/85">
                  eBay's API returned no sold comps for this search, so sell-through rate and
                  sold-price stats aren't available. The active listings below are what
                  sellers are asking — not what buyers paid.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Sold comps */}
          {showSold && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">
                  Recent sold comps
                  <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                    ended with sales ·
                    {result.sold.length < metrics.soldCount
                      ? `${result.sold.length} of ${metrics.soldCount} shown`
                      : `${metrics.soldCount} returned`}
                  </span>
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="px-0 pt-0">
                {result.sold.length === 0 ? (
                  <p className="px-6 py-8 text-center text-[13px] text-muted-foreground">
                    No sold details available for this search.
                  </p>
                ) : (
                  <ul className="divide-y px-6">
                    {result.sold.map((l) => (
                      <ListingRow key={l.itemId || `${l.title}-${l.endedAt}`} listing={l} sold />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Active listings */}
          {showActive && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">
                  Active listings
                  <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                    what sellers are asking now ·
                    {result.active.length < metrics.activeCount
                      ? `${result.active.length} of ${metrics.activeCount} shown`
                      : `${metrics.activeCount} returned`}
                  </span>
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="px-0 pt-0">
                <ul className="divide-y px-6">
                  {result.active.map((l) => (
                    <ListingRow key={l.itemId || `${l.title}-${l.endedAt}`} listing={l} sold={false} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actions + calculator */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Will it profit?</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Purchase price</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="0.00"
                      value={purchase}
                      onChange={(e) => setPurchase(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Est. sale price</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="0.00"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Est. shipping</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="0.00"
                      value={shipping}
                      onChange={(e) => setShipping(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Est. fees</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="0.00"
                      value={fees}
                      onChange={(e) => setFees(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5 col-span-2">
                    <Label>Other costs</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="0.00"
                      value={otherCosts}
                      onChange={(e) => setOtherCosts(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Fees and shipping are your own estimates — eBay's real fees depend on the
                  category and promotions. Calculated exactly with decimal.js in your browser.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/60 px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Est. revenue</p>
                    <p className="text-[15px] font-semibold tabular">
                      {calc.ready ? usd(toNum(calc.revenue)) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Est. costs</p>
                    <p className="text-[15px] font-semibold tabular">
                      {calc.ready ? usd(toNum(calc.costs)) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Est. profit</p>
                    <p
                      className={cn(
                        "text-[15px] font-semibold tabular",
                        calc.ready && calc.profit.gt(0) ? "text-success" : calc.ready && calc.profit.lt(0) ? "text-destructive" : ""
                      )}
                    >
                      {calc.ready ? (calc.profit.gt(0) ? "+" : "") + usd(toNum(calc.profit)) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-3 py-2.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Est. ROI</p>
                    <p
                      className={cn(
                        "text-[15px] font-semibold tabular",
                        calc.ready && calc.roi >= 0 ? "text-success" : "text-muted-foreground"
                      )}
                    >
                      {calc.ready ? percent(calc.roi / 100) : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-primary/20 bg-primary/[0.03]">
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-[14px] font-semibold">Found something worth it?</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                      Start an inventory entry pre-filled with this research. You review and
                      confirm before anything is saved.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={addToInventory}>
                      <PlusCircle className="size-4" />
                      Add to inventory
                    </Button>
                    <Button variant="outline" onClick={saveCurrent} disabled={saving || Boolean(savedId)}>
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : savedId ? (
                        <Check className="size-4" />
                      ) : (
                        <Bookmark className="size-4" />
                      )}
                      {saving ? "Saving…" : savedId ? "Saved to history" : "Save research"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[15px]">
                    <History className="size-4 text-muted-foreground" />
                    Research history
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent className="px-0 pt-0">
                  {history.length === 0 ? (
                    <p className="px-6 py-8 text-center text-[13px] text-muted-foreground">
                      Nothing saved yet — tap "Save research" to keep an item here.
                    </p>
                  ) : (
                    <ul className="divide-y px-2">
                      {history.map((h) => (
                        <li key={h.id} className="flex items-center gap-2 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-medium">{h.query}</p>
                            <p className="mt-0.5 text-[12px] text-muted-foreground">
                              {formatShortDate(h.searchedAt)}
                              {h.result.metrics.soldCount > 0 &&
                                ` · ${h.result.metrics.soldCount} sold`}
                              {h.result.metrics.sellThroughRate !== null &&
                                ` · ${Math.round(h.result.metrics.sellThroughRate)}% sell-through`}
                              {h.result.metrics.estimatedMarketPrice !== null &&
                                ` · ~${usd(h.result.metrics.estimatedMarketPrice)}`}
                            </p>
                          </div>
                          <Badge variant={VERDICT_VARIANT[h.result.verdict]} className="shrink-0">
                            {h.result.verdictLabel}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              setQuery(h.query);
                              void runSearch(h.query);
                            }}
                          >
                            <Search className="size-3.5" />
                            <span className="hidden sm:inline">Search again</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => void removeHistory(h.id)}
                            aria-label={`Remove ${h.query} from history`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        ))}
    </div>
  );
}
