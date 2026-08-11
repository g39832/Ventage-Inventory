import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Circle,
  FileText,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingCart,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ItemImage } from "@/components/common/ItemImage";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MarketplaceBadge } from "@/components/common/MarketplaceBadge";
import { toast } from "sonner";
import {
  computeInventoryKpis,
  computeMoneyKpis,
  dailySeries,
  marketplaceCounts,
  recentItems,
  recentSales,
  salesInDays,
} from "@/lib/data";
import { useData } from "@/lib/store";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";
import type { MarketplaceId } from "@/lib/types";
import { formatDate, formatLastSync, todayISO, usd } from "@/lib/format";

const QUICK_ACTIONS = [
  {
    label: "Add inventory",
    description: "Log a new piece",
    icon: Plus,
    onClick: (nav: ReturnType<typeof useNavigate>) => nav("/inventory/new"),
  },
  {
    label: "Log expense",
    description: "Track a cost",
    icon: Wallet,
    onClick: (nav: ReturnType<typeof useNavigate>) => nav("/expenses"),
  },
  {
    label: "Monthly report",
    description: "Summarize the month",
    icon: FileText,
    onClick: (nav: ReturnType<typeof useNavigate>) => nav("/reports"),
  },
  {
    label: "Connect marketplace",
    description: "Add a sales channel",
    icon: Store,
    onClick: (nav: ReturnType<typeof useNavigate>) => nav("/marketplace"),
  },
];

const TASK_ICONS = {
  listing: Pencil,
  shipping: Package,
  photo: BarChart3,
  sourcing: TrendingUp,
  general: Circle,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { items, sales, expenses, tasks, connections, settings, toggleTask } = useData();

  const kpis = useMemo(() => computeInventoryKpis(items), [items]);
  const money = useMemo(() => computeMoneyKpis(sales, expenses), [sales, expenses]);
  const counts = useMemo(() => marketplaceCounts(items), [items]);
  const recentList = useMemo(() => recentItems(items), [items]);
  const recentListSales = useMemo(() => recentSales(sales), [sales]);

  const profitSpark = useMemo(() => dailySeries(sales, 30), [sales]);
  const salesSpark = useMemo(() => {
    const scoped = salesInDays(sales, 30);
    const byDay = new Map<string, number>();
    for (const s of scoped) byDay.set(s.soldDate, (byDay.get(s.soldDate) ?? 0) + 1);
    return dailySeries(sales, 30).map((d) => ({ date: d.date, value: byDay.get(d.date) ?? 0 }));
  }, [sales]);

  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const firstName = settings.profile.displayName.split(" ")[0] || "there";

  return (
    <div>
      <PageHeader
        title={`Good morning, ${firstName}`}
        description={`Here's what's happening across your shop — ${formatDate(todayISO())}.`}
        actions={
          <Button onClick={() => navigate("/inventory/new")}>
            <Plus className="size-4" />
            Add item
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Inventory"
          value={String(kpis.inventoryCount)}
          delta={8}
          deltaLabel="vs last month"
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="Active listings"
          value={String(kpis.activeListings)}
          delta={12}
          deltaLabel="vs last month"
          icon={<PackageCheck className="size-4" />}
        />
        <StatCard
          label="Drafts"
          value={String(kpis.draftCount)}
          delta={6}
          deltaLabel="vs last month"
          icon={<Pencil className="size-4" />}
        />
        <StatCard
          label="Items sold"
          value={String(kpis.soldCount)}
          delta={18}
          deltaLabel="vs last month"
          icon={<ShoppingCart className="size-4" />}
          spark={salesSpark}
        />
        <StatCard
          label="Profit (30d)"
          value={usd(money.profitLast30)}
          delta={9}
          deltaLabel="vs last month"
          icon={<TrendingUp className="size-4" />}
          iconClass="bg-success/12 text-success border-success/20"
          spark={profitSpark}
        />
        <StatCard
          label="Expenses (30d)"
          value={usd(money.expensesLast30)}
          delta={6}
          deltaLabel="vs last month"
          icon={<Wallet className="size-4" />}
          iconClass="bg-clay/12 text-clay border-clay/20"
        />
      </div>

      {/* Marketplace strip */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-[15px]">Marketplace status</CardTitle>
            <Badge variant="muted" className="font-normal">
              {money.monthRevenue > 0 ? "Revenue this month: " + usd(money.monthRevenue) : ""}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="text-primary" asChild>
            <Link to="/marketplace">
              Manage
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {counts.map(({ id, live }) => {
            const meta = MARKETPLACE_META[id as MarketplaceId];
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigate("/marketplace")}
                className="group flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
              >
                <span className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <span className="size-2 rounded-full" style={{ background: meta.color }} />
                    {meta.name}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: meta.color }}
                  >
                    {formatLastSync(connections.find((c) => c.id === id)?.lastSync)}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {live} live · {meta.monogram === "FM" ? "manual" : meta.name === "eBay" ? "auto-sync" : "tracked"}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent inventory + tasks */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-[15px]">Recently added inventory</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link to="/inventory">
                View all
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="">
            <div className="divide-y">
              {recentList.map((item) => (
                <Link
                  key={item.id}
                  to={`/inventory/${item.id}`}
                  className="group flex items-center gap-3 rounded-md py-2.5 transition-colors hover:bg-accent/40 -mx-1 px-1"
                >
                  <ItemImage
                    src={item.images[0]}
                    alt={item.name}
                    name={item.name}
                    className="size-11 shrink-0 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium group-hover:text-primary">
                      {item.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {item.brand} · {item.category}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="w-16 text-right text-[13px] font-semibold tabular">
                    {usd(item.listingPrice)}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-[15px]">Tasks</CardTitle>
            <Badge variant="muted" className="font-normal">
              {doneCount} of {tasks.length} done
            </Badge>
          </CardHeader>
          <CardContent className="">
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="space-y-1">
              {tasks.map((t) => {
                const Icon = TASK_ICONS[t.kind];
                const checked = t.done;
                return (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-2 transition-colors hover:bg-accent/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        toggleTask(t)
                          .then(() => {
                            toast(checked ? "Task reopened" : "Task completed", {
                              description: t.title,
                            });
                          })
                          .catch(() => {
                            toast.error("Couldn't update task", {
                              description: "Please try again.",
                            });
                          });
                      }}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[13px] font-medium ${
                          checked ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {t.title}
                      </span>
                      {t.due && (
                        <span className="text-[11.5px] text-muted-foreground">
                          <Icon className="mr-1 inline size-3" />
                          Due {formatDate(t.due)}
                        </span>
                      )}
                    </span>
                    {checked && <CheckCircle2 className="mt-0.5 size-4 text-success" />}
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent sales */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-[15px]">Recent sales</CardTitle>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {usd(money.monthRevenue)} revenue this month · {usd(money.totalExpenses)} expenses
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-primary" asChild>
            <Link to="/sales">
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="">
          <div className="divide-y">
            {recentListSales.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-accent/40 -mx-1"
              >
                <ItemImage
                  src={s.thumbnail}
                  alt={s.itemName}
                  name={s.itemName}
                  className="size-11 shrink-0 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{s.itemName}</p>
                  <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <MarketplaceBadge id={s.marketplace} className="text-[10.5px]" />
                    {formatDate(s.soldDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13.5px] font-semibold tabular">{usd(s.soldPrice)}</p>
                  <p className="text-[12px] font-medium text-success tabular">
                    +{usd(s.profit)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => a.onClick(navigate)}
            className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <a.icon className="size-4" />
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold">{a.label}</span>
              <span className="block text-[12px] text-muted-foreground">{a.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
