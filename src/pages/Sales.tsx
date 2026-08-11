import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { MarketplaceBadge } from "@/components/common/MarketplaceBadge";
import { ItemImage } from "@/components/common/ItemImage";
import { EmptyState } from "@/components/common/EmptyState";
import { TablePagination } from "@/components/common/TablePagination";
import { computeSalesKpis } from "@/lib/data";
import { useData } from "@/lib/store";
import { MARKETPLACE_IDS, type MarketplaceId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { daysAgoISO, formatDate, todayISO, usd } from "@/lib/format";
import { toast } from "sonner";

const PER_PAGE = 12;
type SortKey = "soldDate" | "soldPrice" | "payout" | "profit";

const EMPTY_FORM = {
  itemName: "",
  marketplace: "ebay" as MarketplaceId,
  soldDate: todayISO(),
  soldPrice: "",
  fees: "0",
  shippingCost: "0",
  costOfGoods: "",
};

export default function Sales() {
  const { sales, addSale } = useData();
  const kpis = useMemo(() => computeSalesKpis(sales), [sales]);
  const [search, setSearch] = useState("");
  const [marketplace, setMarketplace] = useState("all");
  const [period, setPeriod] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("soldDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff =
      period === "30"
        ? daysAgoISO(30)
        : period === "90"
          ? daysAgoISO(90)
          : period === "180"
            ? daysAgoISO(180)
            : null;

    let list = sales.filter((s) => {
      if (cutoff && s.soldDate < cutoff) return false;
      if (marketplace !== "all" && s.marketplace !== marketplace) return false;
      if (q && !s.itemName.toLowerCase().includes(q)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "soldDate") cmp = a.soldDate.localeCompare(b.soldDate);
      else cmp = a[sortKey] - b[sortKey];
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [search, marketplace, period, sortKey, sortDir, sales]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const setFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const SortHead = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        sortKey === k && "text-foreground"
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

  const hasFilters = search !== "" || marketplace !== "all" || period !== "all";

  const submitSale = () => {
    const price = Number(form.soldPrice);
    if (!form.itemName.trim() || !price || price <= 0) {
      toast.error("Check the sale details", {
        description: "Item name and a sale price above zero are required.",
      });
      return;
    }
    setSaving(true);
    addSale({
      itemName: form.itemName,
      marketplace: form.marketplace,
      soldDate: form.soldDate || todayISO(),
      soldPrice: price,
      fees: Number(form.fees) || 0,
      shippingCost: Number(form.shippingCost) || 0,
      costOfGoods: form.costOfGoods !== "" ? Number(form.costOfGoods) : undefined,
    })
      .then(() => {
        toast("Sale logged", {
          description: `${form.itemName.trim()} sold for ${usd(price)}.`,
        });
        setForm(EMPTY_FORM);
      })
      .catch(() =>
        toast.error("Couldn't log the sale", {
          description: "Please try again.",
        })
      )
      .finally(() => setSaving(false));
  };

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Every sale across all channels, with fees and payouts."
        crumbs={[{ label: "Sales" }]}
        actions={
          <Dialog
            onOpenChange={(open) => {
              if (open) setForm(EMPTY_FORM);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Log sale
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log a sale</DialogTitle>
                <DialogDescription>
                  Record a sale made outside the inventory flow (e.g. from a
                  marketplace order you already fulfilled).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Item name *</Label>
                  <Input
                    placeholder="e.g. Vintage Levi's 501 Jeans"
                    value={form.itemName}
                    onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Sold price (USD) *</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.soldPrice}
                      onChange={(e) => setForm((f) => ({ ...f, soldPrice: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Marketplace</Label>
                    <Select
                      value={form.marketplace}
                      onValueChange={(v) => setForm((f) => ({ ...f, marketplace: v as MarketplaceId }))}
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
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Fees (USD)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.fees}
                      onChange={(e) => setForm((f) => ({ ...f, fees: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Shipping (USD)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.shippingCost}
                      onChange={(e) => setForm((f) => ({ ...f, shippingCost: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Cost of goods (USD)</Label>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={form.costOfGoods}
                      onChange={(e) => setForm((f) => ({ ...f, costOfGoods: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Sale date</Label>
                    <Input
                      type="date"
                      value={form.soldDate}
                      onChange={(e) => setForm((f) => ({ ...f, soldDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submitSale} disabled={saving}>
                  {saving ? "Saving…" : "Log sale"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total sales"
          value={String(kpis.totalSales)}
          delta={22}
          deltaLabel="vs last month"
          icon={<ShoppingCart className="size-4" />}
        />
        <StatCard
          label="Gross revenue"
          value={usd(kpis.grossRevenue)}
          delta={14}
          deltaLabel="vs last month"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="Fees paid"
          value={usd(kpis.totalFees)}
          delta={11}
          deltaLabel="vs last month"
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="Avg sale price"
          value={usd(kpis.avgSale)}
          delta={7}
          deltaLabel="vs last month"
          icon={<TrendingUp className="size-4" />}
        />
      </div>

      <Card className="mb-4 mt-4 gap-0">
        <div className="flex flex-wrap items-center gap-2 px-4">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setFilter(() => setSearch(e.target.value))}
              placeholder="Search sold items…"
              className="pl-9"
            />
          </div>
          <Select value={marketplace} onValueChange={(v) => setFilter(() => setMarketplace(v))}>
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
          <Select value={period} onValueChange={(v) => setFilter(() => setPeriod(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setSearch("");
                setMarketplace("all");
                setPeriod("all");
                setPage(1);
              }}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          )}
          <span className="ml-auto text-[12.5px] text-muted-foreground tabular">
            {filtered.length} sales
          </span>
        </div>
      </Card>

      <Card className="gap-0 p-0!">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>
                <SortHead label="Date" k="soldDate" />
              </TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="hidden md:table-cell">Marketplace</TableHead>
              <TableHead className="text-right">
                <SortHead label="Price" k="soldPrice" />
              </TableHead>
              <TableHead className="hidden text-right sm:table-cell">Fees</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Shipping</TableHead>
              <TableHead className="text-right">
                <SortHead label="Payout" k="payout" />
              </TableHead>
              <TableHead className="text-right">
                <SortHead label="Profit" k="profit" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="p-0!">
                  <EmptyState
                    icon={<ShoppingCart className="size-5" />}
                    title="No sales match"
                    description="Adjust filters, or check back after your next sale."
                    action={
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/inventory">Browse inventory</Link>
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {pageItems.map((s) => (
              <TableRow key={s.id} className="group">
                <TableCell className="text-[13px] text-muted-foreground tabular">
                  {formatDate(s.soldDate)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <ItemImage
                      src={s.thumbnail}
                      alt={s.itemName}
                      name={s.itemName}
                      className="size-10 shrink-0 rounded-md"
                    />
                    <span className="max-w-[240px] truncate text-[13.5px] font-medium">
                      {s.itemName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <MarketplaceBadge id={s.marketplace} />
                </TableCell>
                <TableCell className="text-right text-[13px] font-medium tabular">
                  {usd(s.soldPrice)}
                </TableCell>
                <TableCell className="hidden text-right text-[13px] text-muted-foreground tabular sm:table-cell">
                  {usd(s.fees)}
                </TableCell>
                <TableCell className="hidden text-right text-[13px] text-muted-foreground tabular lg:table-cell">
                  {usd(s.shippingCost)}
                </TableCell>
                <TableCell className="text-right text-[13px] font-semibold tabular">
                  {usd(s.payout)}
                </TableCell>
                <TableCell className="text-right text-[13px] font-semibold text-success tabular">
                  +{usd(s.profit)}
                </TableCell>
              </TableRow>
            ))}
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
    </div>
  );
}
