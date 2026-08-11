import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  CirclePercent,
  PackageCheck,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ItemImage } from "@/components/common/ItemImage";
import { ChartCard, ChartTooltipContent } from "@/components/charts/ChartCard";
import {
  marketplaceMix,
  monthlySeries,
  salesByCategory,
  salesInDays,
  topPerformers,
  weeklySeries,
} from "@/lib/data";
import { useData } from "@/lib/store";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";
import type { MarketplaceId } from "@/lib/types";
import { usd, percent, formatDate } from "@/lib/format";

type Period = "30" | "90" | "180" | "365";

const PERIODS: { value: Period; label: string }[] = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
  { value: "365", label: "12 months" },
];

const CATEGORY_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-tan)",
];

export default function Analytics() {
  const { items, sales, expenses } = useData();
  const [period, setPeriod] = useState<Period>("180");

  const series = useMemo(
    () =>
      period === "30"
        ? weeklySeries(sales, expenses, 5)
        : period === "90"
          ? weeklySeries(sales, expenses, 13)
          : monthlySeries(sales, expenses, period === "365" ? 12 : 6),
    [period, sales, expenses]
  );

  const scoped = useMemo(() => salesInDays(sales, Number(period)), [sales, period]);
  const scopedRevenue = scoped.reduce((s, x) => s + x.soldPrice, 0);
  const scopedProfit = scoped.reduce((s, x) => s + x.profit, 0);
  const margin = scopedRevenue > 0 ? scopedProfit / scopedRevenue : 0;
  const topCategories = useMemo(
    () => salesByCategory(sales, items).slice(0, 6),
    [sales, items]
  );
  const performers = useMemo(() => topPerformers(items, 5), [items]);
  const mix = useMemo(() => marketplaceMix(sales), [sales]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="How your shop is performing across channels and categories."
        crumbs={[{ label: "Analytics" }]}
        actions={
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={usd(scopedRevenue)}
          delta={16}
          deltaLabel="vs prior period"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="Profit"
          value={usd(scopedProfit)}
          delta={12}
          deltaLabel="vs prior period"
          icon={<TrendingUp className="size-4" />}
          iconClass="bg-success/12 text-success border-success/20"
        />
        <StatCard
          label="Items sold"
          value={String(scoped.length)}
          delta={21}
          deltaLabel="vs prior period"
          icon={<PackageCheck className="size-4" />}
        />
        <StatCard
          label="Avg margin"
          value={percent(margin)}
          delta={3}
          deltaLabel="vs prior period"
          icon={<CirclePercent className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Revenue & profit"
          subtitle={`Net of fees and expenses · ${PERIODS.find((p) => p.value === period)?.label.toLowerCase()}`}
          className="xl:col-span-2"
          action={
            <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-1" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-2" /> Profit
              </span>
            </div>
          }
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
                />
                <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: "var(--border)" }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#rev)" />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#prof)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Sales by category" subtitle={`Share of revenue · ${PERIODS.find((p) => p.value === period)?.label.toLowerCase()}`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topCategories}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={112}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="value" name="Revenue" radius={[0, 4, 4, 0]} barSize={16}>
                  {topCategories.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard title="Sales by marketplace" subtitle={`Share of orders · ${PERIODS.find((p) => p.value === period)?.label.toLowerCase()}`}>
          <div className="flex h-64 items-center gap-4">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {mix.map((m) => (
                      <Cell key={m.id} fill={MARKETPLACE_META[m.id as MarketplaceId].color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltipContent formatter={(v) => `${v} orders`} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-semibold tabular">{mix.reduce((s, m) => s + m.value, 0)}</p>
                <p className="text-[11px] text-muted-foreground">orders</p>
              </div>
            </div>
            <ul className="flex-1 space-y-2">
              {mix.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: MARKETPLACE_META[m.id as MarketplaceId].color }}
                    />
                    {m.name}
                  </span>
                  <span className="font-semibold tabular">{m.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-[15px]">Top performers</CardTitle>
            <Badge variant="muted" className="font-normal">
              Most profitable sales
            </Badge>
          </CardHeader>
          <CardContent className="">
            <div className="divide-y">
              {performers.map((item, i) => {
                const profit = (item.soldPrice ?? 0) - item.purchasePrice;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-accent/40 -mx-1"
                  >
                    <span className="w-5 text-center text-[13px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <ItemImage
                      src={item.images[0]}
                      alt={item.name}
                      name={item.name}
                      className="size-10 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {item.brand} · sold {item.soldDate ? formatDate(item.soldDate) : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13.5px] font-semibold tabular">
                        {usd(item.soldPrice ?? 0)}
                      </p>
                      <p className="text-[12px] font-medium text-success tabular">
                        +{usd(profit)} profit
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
