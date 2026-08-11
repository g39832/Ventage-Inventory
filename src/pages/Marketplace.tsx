import { useState } from "react";
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
  DialogTrigger,
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
import { toast } from "sonner";

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
  } = useData();
  const [syncing, setSyncing] = useState<MarketplaceId | null>(null);
  const [accountInput, setAccountInput] = useState("");
  const [connectTarget, setConnectTarget] = useState<MarketplaceId | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<MarketplaceId | null>(null);
  const [working, setWorking] = useState(false);

  const sync = (id: MarketplaceId) => {
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

  const connect = (id: MarketplaceId) => {
    setWorking(true);
    connectMarketplace(id, {
      status: id === "ebay" ? "connected" : "manual",
      account: accountInput.trim() || undefined,
    })
      .then(() => {
        toast(`${MARKETPLACE_META[id].name} connected`, {
          description: "Connection status saved.",
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
    disconnectMarketplace(id)
      .then(() => {
        toast(`${MARKETPLACE_META[id].name} disconnected`, {
          description: "Connection removed — you can reconnect anytime.",
        });
        setDisconnectTarget(null);
      })
      .catch(() =>
        toast.error("Couldn't disconnect", { description: "Please try again." })
      )
      .finally(() => setWorking(false));
  };

  return (
    <div>
      <PageHeader
        title="Marketplace connections"
        description="eBay will sync automatically once the integration ships; every other channel is tracked manually until its integration exists."
        crumbs={[{ label: "Marketplace Connections" }]}
      />

      <Card className="mb-6 border-primary/25 bg-primary/5">
        <CardContent className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="text-[13.5px] leading-relaxed text-foreground/85">
            <p className="font-semibold">How sync works</p>
            <p className="mt-1 text-muted-foreground">
              Connection statuses, accounts, and manual sync times save to your
              database. When the eBay integration ships, its listings, sales, and
              fees will pull in automatically; Depop, Poshmark, Vinted, Mercari,
              and Facebook Marketplace stay manually tracked until their
              integrations exist.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {connections.map((mc) => {
          const meta = MARKETPLACE_META[mc.id];
          const status = STATUS_BADGE[mc.status];
          const connected = mc.status !== "not-connected";
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
                    <p className="text-muted-foreground">Listings</p>
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
                  {mc.note}
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
                              Preferences save to your database.
                            </SheetDescription>
                          </SheetHeader>
                          <div className="space-y-5 px-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[13.5px] font-medium">Auto-refresh listings</p>
                                <p className="text-[12.5px] text-muted-foreground">
                                  Keep live counts up to date
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
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[13.5px] font-medium">Sale notifications</p>
                                <p className="text-[12.5px] text-muted-foreground">
                                  Ping me when something sells here
                                </p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[13.5px] font-medium">Include in reports</p>
                                <p className="text-[12.5px] text-muted-foreground">
                                  Count this channel in analytics
                                </p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                          </div>
                          <SheetFooter>
                            <SheetTrigger asChild>
                              <Button variant="outline">Close</Button>
                            </SheetTrigger>
                          </SheetFooter>
                        </SheetContent>
                      </Sheet>
                    </>
                  ) : (
                    <Dialog
                      open={connectTarget === mc.id}
                      onOpenChange={(open) => {
                        if (!open) setConnectTarget(null);
                      }}
                    >
                      <DialogTrigger asChild>
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
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Connect {mc.name}</DialogTitle>
                          <DialogDescription>
                            {mc.id === "ebay"
                              ? "This is a manual connection for now — the official eBay API integration arrives in a later phase."
                              : "Track this channel manually. No fake API integration — sales and listings stay in sync by hand until an official integration exists."}
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
                                Track {mc.name} manually
                              </span>
                              <CheckCircle2 className="size-4 text-success" />
                            </Button>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={() => connect(mc.id)} disabled={working}>
                            {working ? "Connecting…" : "Connect"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setDisconnectTarget(mc.id)}
                  >
                    <Unplug className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
              The connection and account info are removed. Items already listed
              there stay in your inventory.
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
