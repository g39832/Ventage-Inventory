import { useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  Camera,
  Download,
  Loader2,
  Save,
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
import { useAuth } from "@/lib/auth-provider";
import type { AppSettings } from "@/lib/db/settings";
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

export default function Settings() {
  const { settings, saveSettings } = useData();
  const { user, updateProfile } = useAuth();
  const [tab, setTab] = useState("profile");
  const [form, setForm] = useState<AppSettings>(settings);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
    } catch {
      toast.error("Couldn't upload avatar", { description: "Please try again." });
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

          <TabsContent value="data" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-[15px]">Data & export</CardTitle>
                <CardDescription>
                  CSV export and backups arrive in Phase 7.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Export inventory (CSV)", desc: "All items with costs, prices, and status." },
                  { label: "Export sales history (CSV)", desc: "Every sale with fees and payouts." },
                  { label: "Export expenses (CSV)", desc: "All categorized expenses." },
                ].map((e, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 rounded-lg border p-3.5">
                    <div>
                      <p className="text-[13.5px] font-medium">{e.label}</p>
                      <p className="text-[12.5px] text-muted-foreground">{e.desc}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toast("Coming in Phase 7", {
                          description: `${e.label} export arrives in a later phase.`,
                        })
                      }
                    >
                      <Download className="size-3.5" />
                      Export
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
