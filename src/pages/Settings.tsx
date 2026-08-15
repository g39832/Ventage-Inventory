import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  Camera,
  Download,
  Loader2,
  Save,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/PageHeader";
import { uploadAvatar } from "@/lib/db/photos";
import { useData } from "@/lib/store";
import { downloadCsv } from "@/lib/csv";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";
import { useAuth } from "@/lib/auth-provider";
import { clearAiKey, hasAiKey, saveAiKey, type AppSettings } from "@/lib/db/settings";
import { MARKETPLACE_IDS } from "@/lib/types";
import { initials } from "@/lib/format";
import { toast } from "sonner";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ExportRow({
  label,
  desc,
  onClick,
}: {
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3.5">
      <div>
        <p className="text-[13.5px] font-medium">{label}</p>
        <p className="text-[12.5px] text-muted-foreground">{desc}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onClick}>
        <Download className="size-3.5" />
        Export
      </Button>
    </div>
  );
}

export default function Settings() {
  const { settings, saveSettings, items, sales, expenses } = useData();
  const { user, updateProfile } = useAuth();
  const [tab, setTab] = useState("profile");
  const [form, setForm] = useState<AppSettings>(settings);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Ask Regroove — bring-your-own-key state.
  const [keySaved, setKeySaved] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  useEffect(() => {
    let live = true;
    hasAiKey()
      .then((has) => {
        if (live) setKeySaved(has);
      })
      .catch(() => {
        /* settings row may not exist yet — treat as no key */
      });
    return () => {
      live = false;
    };
  }, []);

  const saveKey = () => {
    const key = keyInput.trim();
    if (!key) return;
    setKeySaving(true);
    saveAiKey(key)
      .then(() => {
        setKeySaved(true);
        setKeyInput("");
        toast("AI key saved", {
          description: "Ask Regroove will use your own key from now on.",
        });
      })
      .catch(() =>
        toast.error("Couldn't save your AI key", {
          description: "Check that the app's database setup is up to date, then try again.",
        })
      )
      .finally(() => setKeySaving(false));
  };

  const removeKey = () => {
    setKeySaving(true);
    clearAiKey()
      .then(() => {
        setKeySaved(false);
        toast("AI key removed", { description: "Ask Regroove will fall back to the server key, if one is set." });
      })
      .catch(() =>
        toast.error("Couldn't remove your AI key", { description: "Please try again." })
      )
      .finally(() => setKeySaving(false));
  };

  const save = (label: string) => {
    setSaving(true);
    saveSettings(form)
      .then(() => toast("Settings saved", { description: `${label} updated.` }))
      .catch(() =>
        toast.error("Couldn't save settings", { description: "Please try again." })
      )
      .finally(() => setSaving(false));
  };

  const saveProfile = () => {
    setSaving(true);
    Promise.all([
      updateProfile({ displayName }),
      saveSettings({
        ...form,
        profile: { ...form.profile, displayName, email: user?.email ?? "" },
      }),
    ])
      .then(() => toast("Profile saved", { description: "Your profile has been updated." }))
      .catch(() =>
        toast.error("Couldn't save your profile", { description: "Please try again." })
      )
      .finally(() => setSaving(false));
  };

  const changeAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
      await updateProfile({ avatarUrl: url });
      toast("Avatar updated", { description: "Your new photo is live." });
    } catch (e) {
      toast.error("Couldn't upload avatar", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const setProfile = (patch: Partial<AppSettings["profile"]>) =>
    setForm((f) => ({ ...f, profile: { ...f.profile, ...patch } }));
  const setShop = (patch: Partial<AppSettings["shop"]>) =>
    setForm((f) => ({ ...f, shop: { ...f.shop, ...patch } }));
  const setNotifications = (patch: Partial<AppSettings["notifications"]>) =>
    setForm((f) => ({ ...f, notifications: { ...f.notifications, ...patch } }));

  const notificationRows = [
    {
      key: "newSales" as const,
      title: "New sales",
      body: "When an item sells on any channel.",
      on: form.notifications.newSales,
    },
    {
      key: "offers" as const,
      title: "Offers & messages",
      body: "New offers across marketplaces.",
      on: form.notifications.offers,
    },
    {
      key: "lowStock" as const,
      title: "Low stock reminders",
      body: "When a category runs low.",
      on: form.notifications.lowStock,
    },
    {
      key: "weeklyDigest" as const,
      title: "Weekly digest",
      body: "A Monday summary of the prior week.",
      on: form.notifications.weeklyDigest,
    },
    {
      key: "listingEnd" as const,
      title: "Listing end notices",
      body: "When listings are about to expire.",
      on: form.notifications.listingEnd,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Your shop's profile, preferences, and defaults."
        crumbs={[{ label: "Settings" }]}
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-4 lg:flex-row">
        <TabsList className="h-fit flex-row justify-start gap-1 bg-transparent p-0 lg:w-48 lg:flex-col lg:items-stretch">
          <TabsTrigger value="profile" className="justify-start gap-2 data-[state=active]:bg-accent/70">
            <User className="size-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="shop" className="justify-start gap-2 data-[state=active]:bg-accent/70">
            <Store className="size-4" /> Shop preferences
          </TabsTrigger>
          <TabsTrigger value="notifications" className="justify-start gap-2 data-[state=active]:bg-accent/70">
            <Bell className="size-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="ai" className="justify-start gap-2 data-[state=active]:bg-accent/70">
            <Sparkles className="size-4" /> Ask Regroove
          </TabsTrigger>
          <TabsTrigger value="data" className="justify-start gap-2 data-[state=active]:bg-accent/70">
            <Building2 className="size-4" /> Data & export
          </TabsTrigger>
        </TabsList>

        <div className="min-w-0 flex-1 space-y-4">
          <TabsContent value="profile" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Profile</CardTitle>
                <CardDescription>
                  How you appear across the app and to buyers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <Avatar className="size-14">
                    {user?.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={displayName || user.displayName || "V"} />
                    ) : null}
                    <AvatarFallback className="bg-clay/15 text-base font-semibold text-clay">
                      {initials(displayName || user?.displayName || "V")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        void changeAvatar(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={avatarUploading}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {avatarUploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Camera className="size-3.5" />
                      )}
                      {avatarUploading
                        ? "Uploading…"
                        : user?.avatarUrl
                          ? "Change photo"
                          : "Add photo"}
                    </Button>
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                      Square image, optimized automatically — shows in the top bar.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Display name">
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="How you appear in the app"
                    />
                  </Field>
                  <Field label="Email" hint="Your sign-in email — managed by your account.">
                    <Input value={user?.email ?? ""} readOnly className="bg-muted/50 text-muted-foreground" />
                  </Field>
                  <Field label="Shop name">
                    <Input
                      value={form.profile.shopName}
                      onChange={(e) => setProfile({ shopName: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone (optional)">
                    <Input
                      value={form.profile.phone}
                      onChange={(e) => setProfile({ phone: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="flex justify-end border-t pt-4">
                  <Button onClick={saveProfile} disabled={saving}>
                    <Save className="size-4" />
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shop" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Shop preferences</CardTitle>
                <CardDescription>
                  Defaults applied when you add items or log sales.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Currency">
                    <Select
                      value={form.shop.currency}
                      onValueChange={(v) => setShop({ currency: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD — US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR — Euro</SelectItem>
                        <SelectItem value="GBP">GBP — British Pound</SelectItem>
                        <SelectItem value="CAD">CAD — Canadian Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Default marketplace" hint="Pre-selected when creating listings.">
                    <Select
                      value={form.shop.defaultMarketplace}
                      onValueChange={(v) => setShop({ defaultMarketplace: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MARKETPLACE_IDS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m === "facebook" ? "Facebook Marketplace" : m.charAt(0).toUpperCase() + m.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Sales tax rate (%)" hint="Used in profit estimates and reports.">
                    <Input
                      type="number"
                      value={form.shop.salesTaxRate}
                      onChange={(e) => setShop({ salesTaxRate: e.target.value })}
                    />
                  </Field>
                  <Field label="Shipping default ($)" hint="Applied to new listings.">
                    <Input
                      type="number"
                      value={form.shop.shippingDefault}
                      onChange={(e) => setShop({ shippingDefault: e.target.value })}
                    />
                  </Field>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13.5px] font-medium">Auto-calculate profit</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        Estimate margin from fees and shipping.
                      </p>
                    </div>
                    <Switch
                      checked={form.shop.autoCalcProfit}
                      onCheckedChange={(on) => setShop({ autoCalcProfit: on })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13.5px] font-medium">Suggest listing price</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        Show a price range from recent sales of similar items.
                      </p>
                    </div>
                    <Switch
                      checked={form.shop.suggestPrice}
                      onCheckedChange={(on) => setShop({ suggestPrice: on })}
                    />
                  </div>
                </div>
                <div className="flex justify-end border-t pt-4">
                  <Button onClick={() => save("Shop preferences")} disabled={saving}>
                    <Save className="size-4" />
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Notifications</CardTitle>
                <CardDescription>
                  What shows up in the bell menu and as toasts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notificationRows.map((n) => (
                  <div key={n.key} className="flex items-center justify-between gap-4 rounded-lg border p-3.5">
                    <div>
                      <p className="text-[13.5px] font-medium">{n.title}</p>
                      <p className="text-[12.5px] text-muted-foreground">{n.body}</p>
                    </div>
                    <Switch
                      checked={n.on}
                      onCheckedChange={(on) =>
                        setNotifications({ [n.key]: on } as Partial<AppSettings["notifications"]>)
                      }
                    />
                  </div>
                ))}
                <div className="flex justify-end border-t pt-4">
                  <Button onClick={() => save("Notifications")} disabled={saving}>
                    <Save className="size-4" />
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Ask Regroove AI</CardTitle>
                <CardDescription>
                  Bring your own OpenAI key to power the assistant. The key is
                  stored with your account and used only for your requests — it
                  never appears in this app's code.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field
                  label="OpenAI API key"
                  hint={
                    keySaved
                      ? "A key is saved on your account. Paste a new one to replace it."
                      : "Create one at platform.openai.com → API keys, then paste it here."
                  }
                >
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={keySaved ? "••••••••••••••••  (key saved)" : "sk-…"}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                  />
                </Field>
                <div className="flex justify-end gap-2 border-t pt-4">
                  {keySaved ? (
                    <Button variant="outline" disabled={keySaving} onClick={removeKey}>
                      Remove key
                    </Button>
                  ) : null}
                  <Button onClick={saveKey} disabled={keySaving || !keyInput.trim()}>
                    {keySaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {keySaving ? "Saving…" : "Save key"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Data & export</CardTitle>
                <CardDescription>
                  Download your data anytime as CSV — perfect for spreadsheets or backups.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ExportRow
                  label="Export inventory (CSV)"
                  desc="All items with costs, prices, and status."
                  onClick={() => {
                    downloadCsv("regroove-inventory.csv", [
                      ["SKU", "Name", "Brand", "Category", "Size", "Era", "Condition", "Status", "Cost", "Asking price", "Sold price", "Acquired", "Listed", "Notes", "Tags"],
                      ...items.map((i) => [
                        i.sku,
                        i.name,
                        i.brand,
                        i.category,
                        i.size,
                        i.era,
                        i.condition,
                        i.status,
                        i.purchasePrice.toFixed(2),
                        i.listingPrice.toFixed(2),
                        i.soldPrice?.toFixed(2) ?? "",
                        i.acquiredDate,
                        i.listedDate ?? "",
                        i.notes.join(" | "),
                        i.tags.join(" | "),
                      ]),
                    ]);
                    toast("Inventory exported", { description: "regroove-inventory.csv downloaded." });
                  }}
                />
                <ExportRow
                  label="Export sales history (CSV)"
                  desc="Every sale with fees and payouts."
                  onClick={() => {
                    downloadCsv("regroove-sales.csv", [
                      ["Date", "Item", "Marketplace", "Sold price", "Fees", "Shipping", "Payout", "Profit"],
                      ...sales.map((s) => [
                        s.soldDate,
                        s.itemName,
                        MARKETPLACE_META[s.marketplace]?.name ?? s.marketplace,
                        s.soldPrice.toFixed(2),
                        s.fees.toFixed(2),
                        s.shippingCost.toFixed(2),
                        s.payout.toFixed(2),
                        s.profit.toFixed(2),
                      ]),
                    ]);
                    toast("Sales exported", { description: "regroove-sales.csv downloaded." });
                  }}
                />
                <ExportRow
                  label="Export expenses (CSV)"
                  desc="All categorized expenses."
                  onClick={() => {
                    downloadCsv("regroove-expenses.csv", [
                      ["Date", "Category", "Description", "Amount"],
                      ...expenses.map((e) => [e.date, e.category, e.description, e.amount.toFixed(2)]),
                    ]);
                    toast("Expenses exported", { description: "regroove-expenses.csv downloaded." });
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14px] font-medium">Need help?</p>
            <p className="text-[13px] text-muted-foreground">
              Questions about your shop, billing, or an eBay connection — reach the app owner directly.
            </p>
          </div>
          {SUPPORT_EMAIL && (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
