import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Info,
  Link2,
  RefreshCw,
  Settings2,
  Store,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/PageHeader";
import { useData } from "@/lib/store";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";
import type { MarketplaceId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatLastSync } from "@/lib/format";
import { ebayStatus, startEbayOAuth, updateEbayCategory } from "@/lib/ebay";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "muted" }> = {
  connected: { label: "Connected", variant: "success" },
  manual: { label: "Manual tracking", variant: "warning" },
  "not-connected": { label: "Not connected", variant: "muted" },
};

export default function Marketplace() {
  const {
    connections,
    connectMarketplace,
    disconnectMarketplace,
    syncMarketplace,
    syncEbay,
    disconnectEbay,
  } = useData();
  const [syncing, setSyncing] = useState<MarketplaceId | null>(null);
  const [ebayWorking, setEbayWorking] = useState(false);
  const [accountInput, setAccountInput] = useState("");
  const [connectTarget, setConnectTarget] = useState<MarketplaceId | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<MarketplaceId | null>(null);
  const [working, setWorking] = useState(false);
  const [ebayInfo, setEbayInfo] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [categoryInput, setCategoryInput] = useState("15687");
  const [categorySaving, setCategorySaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Echo the result of an eBay OAuth round-trip (redirected back here).
  useEffect(() => {
    const ebay = searchParams.get("ebay");
    if (!ebay) return;
    if (ebay === "connected") {
      toast("eBay connected", {
        description: "Your eBay account is linked. You can publish items straight to eBay.",
      });
    } else {
      toast.error("eBay connection failed", {
        description: searchParams.get("message") ?? "Please try again.",
      });
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  // Whether the app owner has registered eBay developer keys on the server.
  useEffect(() => {
    ebayStatus()
      .then((s) => {
        setEbayInfo({ configured: s.configured, connected: s.connected });
      })
      .catch(() => setEbayInfo({ configured: true, connected: false }));
  }, []);

  const sync = (id: MarketplaceId) => {
    if (id === "ebay") {
      setSyncing("ebay");
      syncEbay()
        .then((result) =>
          toast("eBay sync complete", {
            description: `${result.listings} live listings on eBay${
              result.soldCount > 0 ? ` · ${result.soldCount} item${result.soldCount === 1 ? "" : "s"} sold in the last 30 days` : ""
            }.`,
          })
        )
        .catch((e) =>
          toast.error("eBay sync failed", {
            description: e instanceof Error ? e.message : "Please try again.",
          })
        )
        .finally(() => setSyncing(null));
      return;
    }
    setSyncing(id);
    syncMarketplace(id)
      .then(() =>
        toast("Sync complete", {
          description: `${MARKETPLACE_META[id].name} status refreshed.`,
        })
      )
      .catch(() =>
        toast.error("Sync failed", { description: "Please try again." })
      )
      .finally(() => setSyncing(null));
  };

  const connectEbay = async () => {
    setEbayWorking(true);
    try {
      await startEbayOAuth();
      // The browser leaves the app for eBay's sign-in — on return the
      // /ebay/callback route completes the handshake and brings us back.
    } catch (e) {
      toast.error("Couldn't start the eBay connection", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
      setEbayWorking(false);
    }
  };

  const connect = (id: MarketplaceId) => {
    setWorking(true);
    connectMarketplace(id, {
      status: id === "ebay" ? "connected" : "manual",
      account: accountInput.trim() || undefined,
    })
      .then(() => {
        toast(`${MARKETPLACE_META[id].name} connected`, {
          description:
            id === "ebay"
              ? "Marked as connected. For real sync, use the 'Connect with eBay' button."
              : "Connection status saved.",
        });
        setConnectTarget(null);
        setAccountInput("");
      })
      .catch(() =>
        toast.error("Couldn't connect", { description: "Please try again." })
      )
      .finally(() => setWorking(false));
  };

  const disconnect = (id: MarketplaceId) => {
    setWorking(true);
    const done = () => {
      toast(`${MARKETPLACE_META[id].name} disconnected`, {
        description: "Connection removed — you can reconnect anytime.",
      });
      setDisconnectTarget(null);
      setWorking(false);
    };
    if (id === "ebay") {
      disconnectEbay()
        .then(done)
        .catch(() => {
          toast.error("Couldn't disconnect", { description: "Please try again." });
          setWorking(false);
        });
      return;
    }
    disconnectMarketplace(id)
      .then(done)
      .catch(() => {
        toast.error("Couldn't disconnect", { description: "Please try again." });
        setWorking(false);
      });
  };

  const saveCategory = () => {
    const id = categoryInput.trim();
    if (!/^\d+$/.test(id)) {
      toast.error("Invalid category id", { description: "eBay category ids are numbers." });
      return;
    }
    setCategorySaving(true);
    updateEbayCategory(id)
      .then(() =>
        toast("eBay settings saved", {
          description: "New items will publish into category " + id + ".",
        })
      )
      .catch((e) =>
        toast.error("Couldn't save settings", {
          description: e instanceof Error ? e.message : "Please try again.",
        })
      )
      .finally(() => setCategorySaving(false));
  };

  return (
    <div>
      <PageHeader
        title="Marketplace connections"
        description="eBay connects for real — publish listings and pull your live status. Every other channel is tracked manually because those platforms don't offer third-party APIs."
        crumbs={[{ label: "Marketplace Connections" }]}
      />

      <Card className="mb-6 border-primary/25 bg-primary/5">
        <CardContent className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="text-[13.5px] leading-relaxed text-foreground/85">
            <p className="font-semibold">What syncs automatically</p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium text-foreground/90">eBay</span> is fully
              integrated through eBay's official API: connect your account, publish items
              straight from inventory, and pull your live listings and recent orders.
              Depop, Poshmark, Vinted, Mercari, and Facebook Marketplace don't offer
              third-party listing APIs, so they're tracked manually — sales and statuses
              stay in sync by hand.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {connections.map((mc) => {
          const meta = MARKETPLACE_META[mc.id];
          const isEbay = mc.id === "ebay";
          // A real eBay connection requires the OAuth handshake (ebayInfo.connected).
          // A manually-tracked eBay row is NOT "connected" to eBay's API.
          const ebayReal = isEbay && ebayInfo?.connected === true;
          const status = isEbay
            ? ebayReal
              ? { label: "Connected", variant: "success" as const }
              : mc.status === "connected"
                ? { label: "Manual tracking", variant: "warning" as const }
                : STATUS_BADGE["not-connected"]
            : STATUS_BADGE[mc.status];
          const connected = ebayReal || (!isEbay && mc.status !== "not-connected");
          const showDisconnect = connected || (isEbay && mc.status !== "not-connected");
          return (
            <Card key={mc.id} className="gap-0 p-0! transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader className="flex-row items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-10 items-center justify-center rounded-lg text-[13px] font-bold"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.monogram}
                  </span>
                  <div>
                    <CardTitle className="text-[15px]">{mc.name}</CardTitle>
                    <p className="text-[12px] text-muted-foreground">{mc.tagline}</p>
                  </div>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                  <div className="rounded-md bg-muted/60 px-3 py-2">
                    <p className="text-muted-foreground">Account</p>
                    <p className="truncate font-medium">{mc.account ?? "—"}</p>
                  </div>
                  <div className="rounded-md bg-muted/60 px-3 py-2">
                    <p className="text-muted-foreground">{isEbay ? "Live on eBay" : "Listings"}</p>
                    <p className="font-medium tabular">{mc.listings} live</p>
                  </div>
                  <div className="rounded-md bg-muted/60 px-3 py-2">
                    <p className="text-muted-foreground">Last sync</p>
                    <p className="font-medium">{formatLastSync(mc.lastSync)}</p>
                  </div>
                  <div className="rounded-md bg-muted/60 px-3 py-2">
                    <p className="text-muted-foreground">Sync type</p>
                    <p className="font-medium">{mc.syncType === "auto" ? "Automatic" : "Manual"}</p>
                  </div>
                </div>

                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  {isEbay
                    ? ebayInfo?.configured === false
                      ? "eBay needs a one-time setup by the app owner first. Once the owner adds EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_REDIRECT_URI on the server (see EBAY_SETUP.md), the Connect button lights up."
                      : ebayReal
                        ? "Connected through eBay's API. Publish items from any item's Marketplace status tab."
                        : mc.status === "connected"
                          ? "Tracked manually — connect with eBay for the real integration."
                          : "Connect your eBay account to publish listings straight from Threadly."
                    : mc.note ||
                      `${mc.name} doesn't offer a third-party API, so listings and sales are tracked manually here.`}
                </p>

                <Separator />

                <div className="flex items-center gap-2">
                  {connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={syncing === mc.id}
                        onClick={() => sync(mc.id)}
                      >
                        <RefreshCw className={cn("size-3.5", syncing === mc.id && "animate-spin")} />
                        {syncing === mc.id ? "Syncing…" : "Sync now"}
                      </Button>
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1">
                            <Settings2 className="size-3.5" />
                            Manage
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="w-full sm:max-w-md">
                          <SheetHeader>
                            <SheetTitle>Manage {mc.name}</SheetTitle>
                            <SheetDescription>
                              {isEbay
                                ? "eBay settings save to your account and apply when you publish."
                                : "Preferences save to your database."}
                            </SheetDescription>
                          </SheetHeader>
                          <div className="space-y-5 px-4">
                            {isEbay && (
                              <div className="grid gap-2">
                                <Label>
                                  Default eBay category ID
                                </Label>
                                <Input
                                  value={categoryInput}
                                  onChange={(e) => setCategoryInput(e.target.value)}
                                  placeholder="e.g. 15687"
                                />
                                <p className="text-[12px] leading-relaxed text-muted-foreground">
                                  Items you publish use this eBay category. Find the right one
                                  in eBay's listing flow (Seller Hub → choose a category) and
                                  paste its numeric ID. Default: 15687 (Men's T-Shirts).
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={categorySaving}
                                  onClick={saveCategory}
                                >
                                  {categorySaving ? "Saving…" : "Save category"}
                                </Button>
                              </div>
                            )}
                            {!isEbay && (
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[13.5px] font-medium">Auto-refresh listings</p>
                                  <p className="text-[12.5px] text-muted-foreground">
                                    Keep live counts up to date locally
                                  </p>
                                </div>
                                <Switch
                                  checked={mc.syncType === "auto"}
                                  onCheckedChange={(on) => {
                                    connectMarketplace(mc.id, {
                                      syncType: on ? "auto" : "manual",
                                    })
                                      .then(() =>
                                        toast("Settings saved", {
                                          description: `${mc.name} preferences updated.`,
                                        })
                                      )
                                      .catch(() =>
                                        toast.error("Couldn't save settings", {
                                          description: "Please try again.",
                                        })
                                      );
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <SheetFooter>
                            <SheetTrigger asChild>
                              <Button variant="outline">Close</Button>
                            </SheetTrigger>
                          </SheetFooter>
                        </SheetContent>
                      </Sheet>
                    </>
                  ) : isEbay ? (
                    <>
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={ebayWorking || ebayInfo?.configured === false}
                        onClick={() => void connectEbay()}
                      >
                        {ebayWorking ? (
                          <RefreshCw className="size-3.5 animate-spin" />
                        ) : (
                          <Link2 className="size-3.5" />
                        )}
                        {ebayWorking ? "Opening eBay…" : ebayInfo?.configured === false ? "Needs owner setup" : "Connect with eBay"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setConnectTarget("ebay");
                          setAccountInput("");
                        }}
                      >
                        <Store className="size-3.5" />
                        Track manually
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setConnectTarget(mc.id);
                        setAccountInput("");
                      }}
                    >
                      <Link2 className="size-3.5" />
                      Connect account
                    </Button>
                  )}
                  {showDisconnect && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setDisconnectTarget(mc.id)}
                    >
                      <Unplug className="size-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={connectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConnectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {connectTarget ? (connectTarget === "ebay" ? "Track eBay manually" : `Connect ${MARKETPLACE_META[connectTarget].name}`) : ""}
            </DialogTitle>
            <DialogDescription>
              {connectTarget === "ebay"
                ? "Manual tracking just records your eBay account here. It won't publish listings or pull orders — use 'Connect with eBay' for the real integration."
                : `${MARKETPLACE_META[connectTarget ?? "depop"].name} doesn't offer a third-party API, so this records your account for manual tracking. Sales and listings stay in sync by hand.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Store name or username</Label>
              <Input
                placeholder="e.g. grayson.resells"
                value={accountInput}
                onChange={(e) => setAccountInput(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Authorization</Label>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() =>
                  toast("Manual tracking", {
                    description: "No account authorization needed — you'll update statuses by hand.",
                  })
                }
              >
                <span className="flex items-center gap-2">
                  <Store className="size-4" />
                  Track manually
                </span>
                <CheckCircle2 className="size-4 text-success" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => connectTarget && connect(connectTarget)}
              disabled={working}
            >
              {working ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={disconnectTarget !== null}
        onOpenChange={(o) => !o && setDisconnectTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {disconnectTarget ? MARKETPLACE_META[disconnectTarget].name : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disconnectTarget === "ebay"
                ? "Your eBay connection (including the saved sign-in) is removed. Items already listed on eBay stay live on eBay."
                : "The connection and account info are removed. Items already listed there stay in your inventory."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (disconnectTarget) disconnect(disconnectTarget);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
