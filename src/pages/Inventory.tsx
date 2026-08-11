import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Eye,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MarketplaceBadge } from "@/components/common/MarketplaceBadge";
import { ItemImage } from "@/components/common/ItemImage";
import { EmptyState } from "@/components/common/EmptyState";
import { TablePagination } from "@/components/common/TablePagination";
import { computeInventoryKpis, itemProfit } from "@/lib/data";
import { useData } from "@/lib/store";
import { MARKETPLACE_IDS, type Item, type MarketplaceId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/format";
import { toast } from "sonner";

const PER_PAGE = 12;

type SortKey = "name" | "purchasePrice" | "listingPrice" | "profit" | "status";

const STATUS_ORDER: Record<Item["status"], number> = {
  listed: 0,
  draft: 1,
  unlisted: 2,
  sold: 3,
};

export default function Inventory() {
  const navigate = useNavigate();
  const { items, createItem, archiveItem } = useData();
  const kpis = useMemo(() => computeInventoryKpis(items), [items]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [marketplace, setMarketplace] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((i) => {
      if (q) {
        const hay = `${i.name} ${i.brand} ${i.category} ${i.sku} ${i.era}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category !== "all" && i.category !== category) return false;
      if (status !== "all" && i.status !== status) return false;
      if (marketplace !== "all") {
        const m = i.marketplaces[marketplace as MarketplaceId];
        if (!m || m.status !== "live") return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "purchasePrice":
          cmp = a.purchasePrice - b.purchasePrice;
          break;
        case "listingPrice":
          cmp = a.listingPrice - b.listingPrice;
          break;
        case "profit":
          cmp = itemProfit(a) - itemProfit(b);
          break;
        case "status":
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [items, search, category, status, marketplace, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const setFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "status" ? "asc" : "desc");
    }
  };

  const SortHead = ({
    label,
    k,
    className,
  }: {
    label: string;
    k: SortKey;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        className
      )}
    >
      {label}
      {sortKey === k ? (
        sortDir === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );

  const hasFilters =
    search !== "" || category !== "all" || status !== "all" || marketplace !== "all";

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Every piece in your shop, from sourcing to sold."
        crumbs={[{ label: "Inventory" }]}
        actions={
          <Button asChild>
            <Link to="/inventory/new">
              <Plus className="size-4" />
              Add item
            </Link>
          </Button>
        }
      />

      {/* Filter bar */}
      <Card className="mb-4 gap-0">
        <div className="flex flex-wrap items-center gap-2 px-4">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setFilter(() => setSearch(e.target.value))}
              placeholder="Search by name, brand, SKU…"
              className="pl-9"
            />
          </div>
          <Select
            value={category}
            onValueChange={(v) => setFilter(() => setCategory(v))}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setFilter(() => setStatus(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="listed">Listed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={marketplace}
            onValueChange={(v) => setFilter(() => setMarketplace(v))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Marketplace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All marketplaces</SelectItem>
              {MARKETPLACE_IDS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m === "facebook" ? "Facebook Marketplace" : m.charAt(0).toUpperCase() + m.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setSearch("");
                setCategory("all");
                setStatus("all");
                setMarketplace("all");
                setPage(1);
              }}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t px-4 pt-3 text-[12.5px] text-muted-foreground">
          <span className="font-medium text-foreground">{kpis.inventoryCount} total</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success" />
            {kpis.activeListings} listed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-warning" />
            {kpis.draftCount} drafts
          </span>
          <span className="ml-auto tabular">{filtered.length} matching</span>
        </div>
      </Card>

      {/* Table */}
      <Card className="gap-0 p-0!">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>
                <SortHead label="Item" k="name" />
              </TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              <TableHead className="text-right">
                <SortHead label="Purchase" k="purchasePrice" />
              </TableHead>
              <TableHead className="text-right">
                <SortHead label="Listing" k="listingPrice" />
              </TableHead>
              <TableHead className="text-right">
                <SortHead label="Profit" k="profit" />
              </TableHead>
              <TableHead className="hidden xl:table-cell">Marketplaces</TableHead>
              <TableHead>
                <SortHead label="Status" k="status" />
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="p-0!">
                  <EmptyState
                    icon={<PackageSearch className="size-5" />}
                    title="No items match your filters"
                    description="Try adjusting the search or clearing a filter to see more inventory."
                    action={
                      hasFilters ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setCategory("all");
                            setStatus("all");
                            setMarketplace("all");
                            setPage(1);
                          }}
                        >
                          Clear filters
                        </Button>
                      ) : (
                        <Button size="sm" asChild>
                          <Link to="/inventory/new">Add your first item</Link>
                        </Button>
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {pageItems.map((item) => {
              const liveMkts = (Object.entries(item.marketplaces) as [
                MarketplaceId,
                { status: string },
              ][])
                .filter(([, v]) => v.status === "live")
                .map(([k]) => k);
              const profit = itemProfit(item);
              const margin = item.listingPrice > 0 ? profit / item.listingPrice : 0;
              return (
                <TableRow
                  key={item.id}
                  className="group cursor-pointer"
                  tabIndex={0}
                  role="link"
                  aria-label={`View ${item.name}`}
                  onClick={() => navigate(`/inventory/${item.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/inventory/${item.id}`);
                    }
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ItemImage
                        src={item.images[0]}
                        alt={item.name}
                        name={item.name}
                        className="size-11 shrink-0 rounded-md"
                      />
                      <div className="min-w-0">
                        <p className="max-w-[260px] truncate text-[13.5px] font-medium group-hover:text-primary">
                          {item.name}
                        </p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {item.brand} · {item.sku}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-[13px] text-muted-foreground lg:table-cell">
                    {item.category}
                  </TableCell>
                  <TableCell className="text-right text-[13px] tabular text-muted-foreground">
                    {usd(item.purchasePrice)}
                  </TableCell>
                  <TableCell className="text-right text-[13px] font-medium tabular">
                    {item.status === "sold" ? (
                      <span className="text-clay">{usd(item.soldPrice ?? item.listingPrice)}</span>
                    ) : (
                      usd(item.listingPrice)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "text-[13px] font-semibold tabular",
                        item.status === "sold" ? "text-clay" : "text-success"
                      )}
                    >
                      {item.status === "sold" || item.status === "listed"
                        ? `+${usd(profit)}`
                        : "—"}
                    </span>
                    {item.status === "listed" && (
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        {Math.round(margin * 100)}%
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <div className="flex max-w-[220px] flex-wrap items-center gap-1">
                      {liveMkts.length === 0 ? (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      ) : (
                        <>
                          {liveMkts.slice(0, 2).map((m) => (
                            <MarketplaceBadge key={m} id={m} status="live" className="text-[10.5px]" />
                          ))}
                          {liveMkts.length > 2 && (
                            <Badge variant="muted" className="text-[10.5px]">
                              +{liveMkts.length - 2}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
                          <span className="sr-only">Actions</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                            <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
                            <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
                            <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>{item.name}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate(`/inventory/${item.id}`)}>
                          <Eye className="size-4" />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/inventory/${item.id}`)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            createItem({
                              name: `${item.name} (copy)`,
                              brand: item.brand,
                              category: item.category,
                              size: item.size,
                              era: item.era,
                              condition: item.condition,
                              purchasePrice: item.purchasePrice,
                              listingPrice: item.listingPrice,
                              status: "draft",
                              notes: item.notes,
                              tags: item.tags,
                            })
                              .then(() =>
                                toast("Item duplicated", {
                                  description: `A draft copy of ${item.name} was created.`,
                                })
                              )
                              .catch(() =>
                                toast.error("Couldn't duplicate item", {
                                  description: "Please try again.",
                                })
                              );
                          }}
                        >
                          <Copy className="size-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <TablePagination
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          perPage={PER_PAGE}
          onPageChange={setPage}
          className="border-t"
        />
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item from your inventory. It's soft-deleted, so it can
              be restored in a future phase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (!target) return;
                archiveItem(target.id)
                  .then(() => toast("Item deleted", { description: `${target.name} was archived.` }))
                  .catch(() =>
                    toast.error("Couldn't delete item", { description: "Please try again." })
                  );
              }}
            >
              Delete item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
