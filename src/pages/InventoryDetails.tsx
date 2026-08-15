import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ImagePlus,
  Loader2,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/PageHeader";
import { ItemImage } from "@/components/common/ItemImage";
import { PhotoDropzone } from "@/components/common/PhotoDropzone";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MarketplaceBadge } from "@/components/common/MarketplaceBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ImproveListingDialog } from "@/components/listing/ImproveListingDialog";
import { getItem } from "@/lib/data";
import { MAX_PHOTOS_PER_ITEM } from "@/lib/image";
import { useData } from "@/lib/store";
import { MARKETPLACE_IDS, type ItemPhoto, type MarketplaceId } from "@/lib/types";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";
import { cn } from "@/lib/utils";
import { formatDate, todayISO, usd } from "@/lib/format";
import { toast } from "sonner";

const TIMELINE_DOT: Record<string, string> = {
  acquired: "bg-info",
  listed: "bg-success",
  price: "bg-warning",
  sold: "bg-clay",
  note: "bg-muted-foreground",
  expense: "bg-warning",
};

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

const EMPTY_SALE_FORM = {
  soldPrice: "",
  marketplace: "ebay" as MarketplaceId,
  fees: "0",
  shippingCost: "0",
  soldDate: todayISO(),
};

export default function InventoryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    items,
    sales,
    expenses,
    updateItem,
    archiveItem,
    markSold,
    addNote,
    addTimelineNote,
    setListingStatus,
    ebayConnected,
    publishToEbay,
    unlistFromEbay,
    addItemExpense,
    photosByItem,
    addPhoto,
    removePhoto,
    movePhoto,
  } = useData();

  const [activeImage, setActiveImage] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<ItemPhoto | null>(null);
  const [photoDeleting, setPhotoDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    brand: "",
    category: "",
    purchasePrice: "",
    listingPrice: "",
    description: "",
    notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleForm, setSaleForm] = useState(EMPTY_SALE_FORM);
  const [saleSaving, setSaleSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineDraft, setTimelineDraft] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    category: "Shipping" as const,
    description: "",
  });

  const item = useMemo(() => (id ? getItem(items, id) : undefined), [items, id]);
  const photos = useMemo(
    () => (id ? (photosByItem[id] ?? []) : []),
    [photosByItem, id]
  );
  const salesForItem = useMemo(
    () => (id ? sales.filter((s) => s.itemId === id) : []),
    [sales, id]
  );
  const itemExpenses = useMemo(
    () => (id ? expenses.filter((e) => e.itemId === id) : []),
    [expenses, id]
  );

  if (!item) {
    return (
      <div>
        <PageHeader title="Item not found" crumbs={[{ label: "Inventory", to: "/inventory" }]} />
        <Card>
          <EmptyState
            icon={<Package className="size-5" />}
            title="We couldn't find that item"
            description="It may have been removed. Head back to inventory to keep browsing."
            action={
              <Button asChild>
                <Link to="/inventory">Back to inventory</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const profit =
    item.status === "sold"
      ? (item.soldPrice ?? item.listingPrice) - item.purchasePrice
      : item.listingPrice - item.purchasePrice;
  const margin = item.listingPrice > 0 ? profit / item.listingPrice : 0;
  const sale = salesForItem[0];

  const factRows: [string, string][] = [
    ["SKU", item.sku],
    ["Brand", item.brand],
    ["Category", item.category],
    ["Size", item.size],
    ["Era", item.era],
    ["Condition", item.condition],
    ["Acquired", formatDate(item.acquiredDate)],
  ];

  const openEdit = () => {
    setEditForm({
      name: item.name,
      brand: item.brand,
      category: item.category,
      purchasePrice: String(item.purchasePrice),
      listingPrice: String(item.listingPrice),
      description: item.description,
      notes: item.notes.join("\n"),
    });
    setEditOpen(true);
  };

  const submitEdit = () => {
    if (!editForm.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    setEditSaving(true);
    updateItem(item.id, {
      name: editForm.name.trim(),
      brand: editForm.brand.trim(),
      category: editForm.category,
      purchasePrice: Number(editForm.purchasePrice) || 0,
      listingPrice: Number(editForm.listingPrice) || 0,
      description: editForm.description.trim(),
      notes: editForm.notes
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean),
    })
      .then(() => {
        toast("Changes saved", { description: `${editForm.name} was updated.` });
        setEditOpen(false);
      })
      .catch(() =>
        toast.error("Couldn't save changes", { description: "Please try again." })
      )
      .finally(() => setEditSaving(false));
  };

  const openSale = () => {
    setSaleForm({ ...EMPTY_SALE_FORM, soldPrice: String(item.listingPrice) });
    setSaleOpen(true);
  };

  const submitSale = () => {
    const price = Number(saleForm.soldPrice);
    if (!price || price <= 0) {
      toast.error("Enter a sale price above zero");
      return;
    }
    setSaleSaving(true);
    markSold(item, {
      soldPrice: price,
      fees: Number(saleForm.fees) || 0,
      shippingCost: Number(saleForm.shippingCost) || 0,
      marketplace: saleForm.marketplace,
      soldDate: saleForm.soldDate || todayISO(),
    })
      .then(() => {
        toast("Marked as sold", {
          description: `${item.name} sold for ${usd(price)} on ${MARKETPLACE_META[saleForm.marketplace].name}.`,
        });
        setSaleOpen(false);
      })
      .catch(() =>
        toast.error("Couldn't record the sale", { description: "Please try again." })
      )
      .finally(() => setSaleSaving(false));
  };

  const submitNote = () => {
    if (!noteDraft.trim()) return;
    addNote(item.id, noteDraft)
      .then(() => {
        toast("Note added", { description: noteDraft.trim() });
        setNoteDraft("");
        setNoteOpen(false);
      })
      .catch(() =>
        toast.error("Couldn't add note", { description: "Please try again." })
      );
  };

  const submitTimelineNote = () => {
    if (!timelineDraft.trim()) return;
    addTimelineNote(item.id, timelineDraft)
      .then(() => {
        toast("Timeline note added");
        setTimelineDraft("");
        setTimelineOpen(false);
      })
      .catch(() =>
        toast.error("Couldn't add note", { description: "Please try again." })
      );
  };

  const submitItemExpense = () => {
    const amount = Number(expenseForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter an amount above zero");
      return;
    }
    addItemExpense(item, {
      amount,
      category: expenseForm.category,
      description: expenseForm.description,
    })
      .then(() => {
        toast("Expense logged", {
          description: `${expenseForm.description || "Expense"} — ${usd(amount)}.`,
        });
        setExpenseForm({ amount: "", category: "Shipping", description: "" });
        setExpenseOpen(false);
      })
      .catch(() =>
        toast.error("Couldn't log expense", { description: "Please try again." })
      );
  };

  const toggleListing = (m: MarketplaceId) => {
    const listing = item.marketplaces[m];
    const isLive = listing?.status === "live";

    // eBay goes through the real API when the account is connected.
    if (m === "ebay" && ebayConnected) {
      if (isLive) {
        unlistFromEbay(item)
          .then(() => {
            toast("Ended on eBay", {
              description: `${item.name} was unlisted from eBay.`,
            });
          })
          .catch((e) =>
            toast.error("Couldn't unlist from eBay", {
              description: e instanceof Error ? e.message : "Please try again.",
            })
          );
      } else {
        publishToEbay(item)
          .then((updated) => {
            const listingId = updated.marketplaces.ebay?.listingId;
            toast("Published to eBay", {
              description: `${item.name} is now live at ${usd(item.listingPrice)}${listingId ? ` · ${listingId}` : ""}.`,
            });
          })
          .catch((e) =>
            toast.error("Couldn't publish to eBay", {
              description: e instanceof Error ? e.message : "Please try again.",
            })
          );
      }
      return;
    }

    setListingStatus(item, m, isLive ? "none" : "live")
      .then(() => {
        toast(isLive ? `Removed from ${MARKETPLACE_META[m].name}` : `Listed on ${MARKETPLACE_META[m].name}`, {
          description: isLive ? "Listing taken down." : `${item.name} is now live at ${usd(item.listingPrice)}.`,
        });
      })
      .catch(() =>
        toast.error("Couldn't update the listing", { description: "Please try again." })
      );
  };

  const uploadPhotos = async () => {
    if (!photoFiles.length || !item) return;
    setPhotoUploading(true);
    try {
      for (const file of photoFiles) {
        await addPhoto(item.id, file);
      }
      toast(`Uploaded ${photoFiles.length} photo${photoFiles.length === 1 ? "" : "s"}`);
      setPhotoFiles([]);
      setPhotoOpen(false);
    } catch (e) {
      toast.error("Upload failed", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setPhotoUploading(false);
    }
  };

  const confirmDeletePhoto = async () => {
    if (!photoToDelete) return;
    setPhotoDeleting(true);
    try {
      await removePhoto(photoToDelete);
      toast("Photo removed");
      setPhotoToDelete(null);
    } catch {
      toast.error("Couldn't remove the photo", { description: "Please try again." });
    } finally {
      setPhotoDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={item.name}
        description={`${item.brand} · ${item.category}`}
        crumbs={[
          { label: "Inventory", to: "/inventory" },
          { label: item.name },
        ]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/inventory">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles className="size-4" />
              Ask AI
            </Button>
            <Button variant="outline" onClick={openEdit}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button disabled={item.status === "sold"} onClick={openSale}>
              Mark as sold
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Gallery */}
        <div className="lg:col-span-3">
          <ItemImage
            src={item.images[Math.min(activeImage, Math.max(0, item.images.length - 1))]}
            alt={item.name}
            name={item.name}
            className="aspect-[4/5] w-full rounded-xl border shadow-sm"
          />
          {photos.length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {photos.map((p, i) => (
                <div
                  key={p.id}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border transition-all",
                    activeImage === i
                      ? "border-primary ring-2 ring-primary/30"
                      : "opacity-70 hover:opacity-100"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className="block size-full"
                  >
                    <ItemImage
                      src={p.url}
                      alt={`${item.name} ${i + 1}`}
                      name={item.name}
                      className="aspect-square w-full"
                    />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
                      Cover
                    </span>
                  )}
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {i > 0 && (
                      <button
                        type="button"
                        aria-label="Move photo left"
                        onClick={() => movePhoto(item.id, p.id, -1)}
                        className="flex size-6 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                    )}
                    {i < photos.length - 1 && (
                      <button
                        type="button"
                        aria-label="Move photo right"
                        onClick={() => movePhoto(item.id, p.id, 1)}
                        className="flex size-6 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Delete photo"
                      onClick={() => setPhotoToDelete(p)}
                      className="flex size-6 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-destructive hover:text-white"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {item.images.slice(0, 4).map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "overflow-hidden rounded-lg border transition-all",
                    activeImage === i
                      ? "border-primary ring-2 ring-primary/30"
                      : "opacity-70 hover:opacity-100"
                  )}
                >
                  <ItemImage src={src} alt={`${item.name} ${i + 1}`} name={item.name} className="aspect-square w-full" />
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" className="mt-3 w-full" onClick={() => setPhotoOpen(true)}>
            <ImagePlus className="size-4" />
            {photos.length > 0 ? "Add photos" : "Upload photos"}
          </Button>
        </div>

        {/* Facts panel */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="">
              <div className="flex items-center justify-between">
                <StatusBadge status={item.status} />
                <Badge variant="muted">{item.era} · {item.size}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {item.status === "sold" ? "Sold for" : "Listing price"}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight tabular">
                      {usd(item.status === "sold" ? (item.soldPrice ?? item.listingPrice) : item.listingPrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Profit</p>
                    <p className="mt-1 text-lg font-semibold text-success tabular">
                      +{usd(profit)}
                      <span className="ml-1 text-[12px] text-muted-foreground">
                        ({Math.round(margin * 100)}%)
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-[13px]">
                  <span className="text-muted-foreground">Cost of goods</span>
                  <span className="font-medium tabular">{usd(item.purchasePrice)}</span>
                </div>
                {item.status === "sold" && sale && (
                  <div className="mt-2 flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Fees + shipping</span>
                    <span className="font-medium tabular text-destructive">
                      −{usd(sale.fees + sale.shippingCost)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="font-normal">
                    {t}
                  </Badge>
                ))}
              </div>

              <Separator />

              <dl className="space-y-2">
                {factRows.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 text-[13px]">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>

              <Separator />

              <div>
                <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Marketplace status
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MARKETPLACE_IDS.map((m) => {
                    const listing = item.marketplaces[m];
                    return (
                      <MarketplaceBadge
                        key={m}
                        id={m}
                        status={listing?.status === "live" ? "live" : listing?.status === "sold" ? "sold" : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="">
              <CardTitle className="text-[15px]">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {item.description && (
                <div className="rounded-lg border bg-muted/30 px-3.5 py-3">
                  <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Listing description
                  </p>
                  <p className="text-[13px] leading-relaxed text-foreground/90">{item.description}</p>
                </div>
              )}
              {item.notes.map((n, i) => (
                <p key={i} className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  {n}
                </p>
              ))}
              {noteOpen ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    placeholder="Write a note about this piece…"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={submitNote} disabled={!noteDraft.trim()}>
                      Save note
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNoteOpen(false);
                        setNoteDraft("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-1" onClick={() => setNoteOpen(true)}>
                  <Plus className="size-3.5" />
                  Add note
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Card className="mt-6 gap-0 p-0!">
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="mx-4 mt-4 bg-transparent">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="marketplaces">Marketplace status</TabsTrigger>
            <TabsTrigger value="sales">Sales history</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>
          <div className="px-6 py-5">
            <TabsContent value="timeline">
              <div className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-border">
                {item.timeline.map((e, i) => (
                  <div key={i} className="relative pl-7">
                    <span
                      className={cn(
                        "absolute top-1 left-0 size-3.5 rounded-full border-2 border-background",
                        TIMELINE_DOT[e.kind] ?? "bg-muted-foreground"
                      )}
                    />
                    <p className="text-[13.5px] font-semibold">{e.title}</p>
                    <p className="text-[12.5px] text-muted-foreground">{e.description}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground/80">
                      {formatDate(e.date)}
                    </p>
                  </div>
                ))}
                {timelineOpen ? (
                  <div className="space-y-2 pl-7">
                    <textarea
                      autoFocus
                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                      placeholder="Private note for your own records…"
                      value={timelineDraft}
                      onChange={(e) => setTimelineDraft(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={submitTimelineNote} disabled={!timelineDraft.trim()}>
                        Save note
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTimelineOpen(false);
                          setTimelineDraft("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-7 text-muted-foreground"
                    onClick={() => setTimelineOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    Add timeline note
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="marketplaces">
              <div className="space-y-2">
                {MARKETPLACE_IDS.map((m) => {
                  const listing = item.marketplaces[m];
                  const meta = MARKETPLACE_META[m];
                  const state = listing?.status ?? "none";
                  const isLive = state === "live";
                  return (
                    <div
                      key={m}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-9 items-center justify-center rounded-lg text-[12px] font-bold"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.monogram}
                        </span>
                        <div>
                          <p className="text-[13.5px] font-semibold">{meta.name}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {isLive
                              ? `Live at ${usd(listing?.price ?? item.listingPrice)}${listing?.listingId ? ` · ${listing.listingId}` : ""}`
                              : state === "sold"
                                ? `Sold at ${usd(listing?.price ?? item.listingPrice)}`
                                : m === "ebay" && ebayConnected
                                  ? "Not on eBay yet — publish it with the button"
                                  : "Not listed here"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MarketplaceBadge id={m} status={isLive ? "live" : state === "sold" ? "sold" : undefined} />
                        {item.status !== "sold" && (
                          <Button
                            variant={isLive ? "outline" : "default"}
                            size="sm"
                            className="h-7"
                            onClick={() => toggleListing(m)}
                          >
                            <Tag className="size-3.5" />
                            {isLive ? "Unlist" : "List"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="sales">
              {salesForItem.length === 0 ? (
                <EmptyState
                  icon={<ShoppingCart className="size-5" />}
                  title="No sales yet for this item"
                  description="When it sells, the sale, fees, and payout will appear here."
                  action={
                    <Button variant="outline" size="sm" onClick={openSale} disabled={item.status === "sold"}>
                      Mark as sold
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {salesForItem.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5">
                      <div>
                        <p className="text-[13.5px] font-semibold">{s.itemName}</p>
                        <p className="text-[12px] text-muted-foreground">
                          Sold {formatDate(s.soldDate)} · {MARKETPLACE_META[s.marketplace].name}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-right">
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase">Price</p>
                          <p className="text-[13.5px] font-semibold tabular">{usd(s.soldPrice)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase">Fees</p>
                          <p className="text-[13.5px] tabular">{usd(s.fees)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase">Payout</p>
                          <p className="text-[13.5px] font-semibold text-success tabular">{usd(s.payout)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="expenses">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <CircleDollarSign className="size-4" />
                    </span>
                    <div>
                      <p className="text-[13.5px] font-semibold">Cost of goods</p>
                      <p className="text-[12px] text-muted-foreground">Sourcing cost for this piece</p>
                    </div>
                  </div>
                  <p className="text-[14px] font-semibold tabular">{usd(item.purchasePrice)}</p>
                </div>
                {itemExpenses.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Wallet className="size-4" />
                      </span>
                      <div>
                        <p className="text-[13.5px] font-semibold">{e.description}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {e.category} · {formatDate(e.date)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[14px] font-semibold tabular text-destructive">
                      −{usd(e.amount)}
                    </p>
                  </div>
                ))}
                {sale && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Wallet className="size-4" />
                      </span>
                      <div>
                        <p className="text-[13.5px] font-semibold">Sale fees & shipping</p>
                        <p className="text-[12px] text-muted-foreground">{MARKETPLACE_META[sale.marketplace].name} fees plus postage</p>
                      </div>
                    </div>
                    <p className="text-[14px] font-semibold tabular text-destructive">
                      −{usd(sale.fees + sale.shippingCost)}
                    </p>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
                  <Plus className="size-3.5" />
                  Log expense
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </Card>

      {/* Edit sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit item</SheetTitle>
            <SheetDescription>
              Update details and pricing — changes save to your database.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <div className="grid gap-2">
              <Label>Item name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Brand</Label>
                <Input
                  value={editForm.brand}
                  onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Purchase price</Label>
                <Input
                  type="number"
                  value={editForm.purchasePrice}
                  onChange={(e) => setEditForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Listing price</Label>
                <Input
                  type="number"
                  value={editForm.listingPrice}
                  onChange={(e) => setEditForm((f) => ({ ...f, listingPrice: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Listing description</Label>
              <textarea
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                placeholder="What a buyer sees — era, condition, standout features…"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <textarea
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={submitEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Mark as sold dialog */}
      <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as sold</DialogTitle>
            <DialogDescription>
              Record the final sale price, fees, and where it sold.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Sale price (USD) *</Label>
                <Input
                  type="number"
                  value={saleForm.soldPrice}
                  onChange={(e) => setSaleForm((f) => ({ ...f, soldPrice: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Marketplace</Label>
                <Select
                  value={saleForm.marketplace}
                  onValueChange={(v) => setSaleForm((f) => ({ ...f, marketplace: v as MarketplaceId }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKETPLACE_IDS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MARKETPLACE_META[m].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Fees (USD)</Label>
                <Input
                  type="number"
                  value={saleForm.fees}
                  onChange={(e) => setSaleForm((f) => ({ ...f, fees: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Shipping (USD)</Label>
                <Input
                  type="number"
                  value={saleForm.shippingCost}
                  onChange={(e) => setSaleForm((f) => ({ ...f, shippingCost: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Sale date</Label>
              <Input
                type="date"
                value={saleForm.soldDate}
                onChange={(e) => setSaleForm((f) => ({ ...f, soldDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitSale} disabled={saleSaving}>
              {saleSaving ? "Saving…" : "Confirm sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log item expense dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log an expense for this item</DialogTitle>
            <DialogDescription>
              Cleaning, repair, packaging, or any cost tied to this piece.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                placeholder="e.g. Dry cleaning"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Amount (USD) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(v) =>
                    setExpenseForm((f) => ({
                      ...f,
                      category: v as typeof expenseForm.category,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Shipping", "Packaging & Supplies", "Fees", "Cleaning & Repair", "Photography", "Storage", "Sourcing", "Software & Tools"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitItemExpense}>Log expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add photos dialog */}
      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add photos</DialogTitle>
            <DialogDescription>
              Photos are optimized automatically and stored in your workspace —
              the first one becomes the cover. Up to {MAX_PHOTOS_PER_ITEM} per item.
            </DialogDescription>
          </DialogHeader>
          <PhotoDropzone files={photoFiles} onChange={setPhotoFiles} disabled={photoUploading} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPhotoFiles([]);
                setPhotoOpen(false);
              }}
              disabled={photoUploading}
            >
              Cancel
            </Button>
            <Button onClick={uploadPhotos} disabled={!photoFiles.length || photoUploading}>
              {photoUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <ImagePlus className="size-4" />
                  Upload {photoFiles.length} photo{photoFiles.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!photoToDelete}
        onOpenChange={(open) => {
          if (!open && !photoDeleting) setPhotoToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              The photo will be deleted from storage. You can upload a new one anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={photoDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={photoDeleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeletePhoto();
              }}
            >
              {photoDeleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImproveListingDialog item={item} open={aiOpen} onOpenChange={setAiOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{item.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item from inventory permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setDeleteOpen(false);
                archiveItem(item.id)
                  .then(() => {
                    toast("Item deleted", { description: item.name });
                    navigate("/inventory");
                  })
                  .catch(() =>
                    toast.error("Couldn't delete item", { description: "Please try again." })
                  );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
