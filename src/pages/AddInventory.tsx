import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/PageHeader";
import { ItemImage } from "@/components/common/ItemImage";
import { PhotoDropzone } from "@/components/common/PhotoDropzone";
import { useData } from "@/lib/store";
import { MARKETPLACE_IDS, type MarketplaceId } from "@/lib/types";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/format";
import { toast } from "sonner";

const CATEGORIES = [
  "Jackets & Coats",
  "Tops & Tees",
  "Hoodies & Sweats",
  "Flannels & Shirts",
  "Knitwear & Sweaters",
  "Denim & Pants",
  "Outerwear",
  "Hats & Accessories",
  "Shoes",
];

const ERAS = ["60s", "70s", "80s", "90s", "2000s", "2010s"];

export default function AddInventory() {
  const navigate = useNavigate();
  const { createItem, addPhoto } = useData();
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    size: "",
    era: "",
    condition: "Very good",
    purchasePrice: "",
    listingPrice: "",
    description: "",
    notes: "",
    marketplaces: [] as string[],
    status: "listed",
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const purchase = Number(form.purchasePrice) || 0;
  const listing = Number(form.listingPrice) || 0;
  const previewName = form.name || "Untitled piece";
  const previewBrand = form.brand || "Your brand";

  const canContinue =
    form.name.trim() !== "" &&
    form.brand.trim() !== "" &&
    form.category !== "" &&
    form.purchasePrice !== "" &&
    form.listingPrice !== "";

  // First selected photo drives the live preview while adding.
  useEffect(() => {
    if (!photos[0]) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(photos[0]);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photos]);

  const submit = async () => {
    setSaving(true);
    try {
      const item = await createItem({
        name: form.name,
        brand: form.brand,
        category: form.category,
        size: form.size || undefined,
        era: form.era || undefined,
        condition: form.condition,
        purchasePrice: purchase,
        listingPrice: listing,
        status: form.status as "listed" | "draft",
        description: form.description.trim(),
        notes: form.notes.trim() ? [form.notes.trim()] : [],
        marketplaces: form.marketplaces as MarketplaceId[],
      });
      // Upload photos after the item exists (photos live under the item id).
      for (const file of photos) {
        await addPhoto(item.id, file);
      }
      toast("Item added", {
        description: `“${form.name}” is now in your inventory.`,
      });
      navigate(`/inventory/${item.id}`);
    } catch (e) {
      toast.error("Couldn't add the item", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleMarket = (m: string) =>
    setForm((f) => ({
      ...f,
      marketplaces: f.marketplaces.includes(m)
        ? f.marketplaces.filter((x) => x !== m)
        : [...f.marketplaces, m],
    }));

  return (
    <div>
      <PageHeader
        title="Add inventory"
        description="Log a new piece so it's ready to list."
        crumbs={[
          { label: "Inventory", to: "/inventory" },
          { label: "Add item" },
        ]}
      />

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-3">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {step > s ? <Check className="size-3.5" /> : s}
              </span>
              <span
                className={cn(
                  "text-[13px] font-medium",
                  step >= s ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s === 1 ? "Item details" : "Listing & photos"}
              </span>
            </div>
            {s === 1 && <Separator className="w-12" />}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-5">
            {step === 1 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Item name *</Label>
                    <Input
                      placeholder="e.g. Vintage Levi's Trucker Jacket"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Brand *</Label>
                    <Input
                      placeholder="e.g. Levi's"
                      value={form.brand}
                      onChange={(e) => set("brand", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Category *</Label>
                    <Select value={form.category} onValueChange={(v) => set("category", v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Size</Label>
                    <Input
                      placeholder="e.g. M, 34×32, US 9"
                      value={form.size}
                      onChange={(e) => set("size", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Era</Label>
                    <Select value={form.era} onValueChange={(v) => set("era", v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select era" />
                      </SelectTrigger>
                      <SelectContent>
                        {ERAS.map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Condition</Label>
                    <Select value={form.condition} onValueChange={(v) => set("condition", v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Excellent", "Very good", "Good", "Fair — flaws"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Purchase price (USD) *</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.purchasePrice}
                      onChange={(e) => set("purchasePrice", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Listing price (USD) *</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.listingPrice}
                      onChange={(e) => set("listingPrice", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Listing description</Label>
                    <Textarea
                      placeholder="What a buyer sees — era, condition, standout features…"
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Private condition notes, flaws, measurements…"
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>Listing status</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "listed", label: "List now", hint: "Publish right away" },
                      { value: "draft", label: "Save as draft", hint: "Publish later" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set("status", opt.value)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-all",
                          form.status === opt.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <p className="text-[13.5px] font-semibold">{opt.label}</p>
                        <p className="text-[12px] text-muted-foreground">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>List on marketplaces</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {MARKETPLACE_IDS.map((m) => {
                      const meta = MARKETPLACE_META[m];
                      const on = form.marketplaces.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleMarket(m)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all",
                            on
                              ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                              : "text-muted-foreground hover:bg-muted/60"
                          )}
                        >
                          <span className="size-2 rounded-full" style={{ background: meta.color }} />
                          {meta.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Photos</Label>
                  <PhotoDropzone files={photos} onChange={setPhotos} disabled={saving} />
                </div>
              </>
            )}

            <div className="flex items-center justify-between border-t pt-5">
              {step === 2 ? (
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              ) : (
                <Button variant="ghost" asChild className="text-muted-foreground">
                  <Link to="/inventory">Cancel</Link>
                </Button>
              )}
              {step === 1 ? (
                <Button onClick={() => setStep(2)} disabled={!canContinue}>
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={saving}>
                  <Check className="size-4" />
                  {saving ? "Saving…" : form.status === "listed" ? "Add & list item" : "Save as draft"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Listing preview
          </p>
          <Card className="overflow-hidden p-0!">
            <div className="relative">
              <ItemImage src={previewUrl} alt={previewName} name={previewName} className="aspect-square w-full" />
              <div className="absolute top-3 left-3 flex gap-1.5">
                <Badge variant="secondary" className="bg-background/90 backdrop-blur">
                  <Shirt className="size-3" />
                  {form.category || "Category"}
                </Badge>
                {form.status === "listed" ? (
                  <Badge variant="success" className="bg-background/90 backdrop-blur">Listed</Badge>
                ) : (
                  <Badge variant="warning" className="bg-background/90 backdrop-blur">Draft</Badge>
                )}
              </div>
            </div>
            <CardContent className="space-y-3">
              <div>
                <p className="text-[15px] font-semibold leading-snug">{previewName}</p>
                <p className="text-[13px] text-muted-foreground">
                  {previewBrand}
                  {form.era && ` · ${form.era}`}
                  {form.size && ` · ${form.size}`}
                </p>
              </div>
              <div className="flex items-end justify-between rounded-lg bg-muted/50 p-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Asking
                  </p>
                  <p className="text-xl font-semibold tracking-tight tabular">
                    {listing > 0 ? usd(listing) : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Potential profit
                  </p>
                  <p className={cn("text-sm font-semibold tabular", listing > purchase ? "text-success" : "text-muted-foreground")}>
                    {listing > 0 ? `+${usd(Math.max(0, listing - purchase))}` : "—"}
                  </p>
                </div>
              </div>
              {form.marketplaces.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.marketplaces.map((m) => (
                    <Badge key={m} variant="secondary" className="font-normal">
                      {MARKETPLACE_META[m as keyof typeof MARKETPLACE_META].name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
