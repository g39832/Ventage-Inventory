import { useMemo, useState } from "react";
import {
  CalendarRange,
  Download,
  FileBarChart,
  FileSpreadsheet,
  Landmark,
  Package,
  Plus,
  Printer,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { PageHeader } from "@/components/common/PageHeader";
import { computeInventoryKpis, computeMoneyKpis, expensesByCategory, marketplaceMix, salesByCategory } from "@/lib/data";
import { useData } from "@/lib/store";
import { monthInputValue, monthLabel, usd } from "@/lib/format";
import { sumToNum } from "@/lib/money";
import { downloadCsv, printReport } from "@/lib/csv";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";
import type { Expense, Item, Sale } from "@/lib/types";
import { toast } from "sonner";

type ReportType =
  | "pnl-monthly"
  | "pnl-quarterly"
  | "yearly"
  | "tax"
  | "valuation"
  | "top-sellers";

type ReportFormat = "csv" | "pdf";

interface BuiltReport {
  title: string;
  filename: string;
  rows: (string | number | null | undefined)[][];
}

function monthStart(month: string): string {
  return `${month}-01`;
}

function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rangeFor(month: string, type: ReportType): { start: string; end: string } {
  if (type === "pnl-monthly") {
    return { start: monthStart(month), end: monthStart(addMonths(month, 1)) };
  }
  if (type === "pnl-quarterly") {
    const q = Math.floor(Number(month.slice(5)) / 3); // 0..3
    const startMonth = `${month.slice(0, 4)}-${String(q * 3 + 1).padStart(2, "0")}`;
    return { start: monthStart(startMonth), end: monthStart(addMonths(startMonth, 3)) };
  }
  const year = month.slice(0, 4);
  return { start: `${year}-01-01`, end: `${Number(year) + 1}-01-01` };
}

function inRange(sales: Sale[], range: { start: string; end: string }): Sale[] {
  return sales.filter((s) => s.soldDate >= range.start && s.soldDate < range.end);
}

function inRangeExpenses(expenses: Expense[], range: { start: string; end: string }): Expense[] {
  return expenses.filter((e) => e.date >= range.start && e.date < range.end);
}

function cogsFor(sales: Sale[], items: Item[]): number {
  return sumToNum(
    sales.map((s) =>
      s.itemId ? (items.find((i) => i.id === s.itemId)?.purchasePrice ?? 0) : 0
    )
  );
}

const MONEY = (n: number) => n.toFixed(2);

function buildReport(
  type: ReportType,
  month: string,
  items: Item[],
  sales: Sale[],
  expenses: Expense[]
): BuiltReport {
  const range = rangeFor(month, type);
  const inSales = inRange(sales, range);
  const inExpenses = inRangeExpenses(expenses, range);
  const gross = sumToNum(inSales.map((s) => s.soldPrice));
  const fees = sumToNum(inSales.map((s) => s.fees));
  const shipping = sumToNum(inSales.map((s) => s.shippingCost));
  const cogs = cogsFor(inSales, items);
  const expTotal = sumToNum(inExpenses.map((e) => e.amount));
  const profit = gross - fees - shipping - cogs - expTotal;

  const label = monthLabel(range.start);

  if (type === "pnl-monthly") {
    const byCat = expensesByCategory(inExpenses);
    const rows: (string | number | null | undefined)[][] = [
      ["Metric", "Amount (USD)"],
      ["Gross sales", MONEY(gross)],
      ["Fees", MONEY(fees)],
      ["Shipping costs", MONEY(shipping)],
      ["Cost of goods sold", MONEY(cogs)],
      ["Expenses", MONEY(expTotal)],
      ["Net profit", MONEY(profit)],
      [],
      ["Expense breakdown", ""],
      ["Category", "Total (USD)"],
      ...byCat.map((c) => [c.category, MONEY(c.total)]),
      [],
      ["Sales", ""],
      ["Total orders", inSales.length],
      ["Average sale", MONEY(inSales.length ? gross / inSales.length : 0)],
    ];
    return { title: `Monthly P&L — ${label}`, filename: `regroove-pnl-${month}.csv`, rows };
  }

  if (type === "pnl-quarterly") {
    const mix = marketplaceMix(inSales);
    const byCat = salesByCategory(inSales, items);
    const rows: (string | number | null | undefined)[][] = [
      ["Metric", "Amount (USD)"],
      ["Gross sales", MONEY(gross)],
      ["Fees", MONEY(fees)],
      ["Shipping costs", MONEY(shipping)],
      ["Cost of goods sold", MONEY(cogs)],
      ["Expenses", MONEY(expTotal)],
      ["Net profit", MONEY(profit)],
      [],
      ["Sales by marketplace", ""],
      ["Marketplace", "Orders", "Revenue (USD)"],
      ...mix.map((m) => [m.name, m.value, MONEY(sumToNum(inSales.filter((s) => s.marketplace === m.id).map((s) => s.soldPrice)))]),
      [],
      ["Sales by category", ""],
      ["Category", "Revenue (USD)"],
      ...byCat.map((c) => [c.category, MONEY(c.value)]),
    ];
    return { title: `Quarterly summary — ${label}`, filename: `regroove-quarterly-${month}.csv`, rows };
  }

  if (type === "yearly") {
    const year = month.slice(0, 4);
    const monthly: { month: string; revenue: number; fees: number; shipping: number; expenses: number; profit: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const key = `${year}-${String(m + 1).padStart(2, "0")}`;
      const r = rangeFor(key, "pnl-monthly");
      const ms = inRange(sales, r);
      const me = inRangeExpenses(expenses, r);
      const rev = sumToNum(ms.map((s) => s.soldPrice));
      const fe = sumToNum(ms.map((s) => s.fees));
      const sh = sumToNum(ms.map((s) => s.shippingCost));
      const ex = sumToNum(me.map((e) => e.amount));
      const cg = cogsFor(ms, items);
      monthly.push({ month: monthLabel(key), revenue: rev, fees: fe, shipping: sh, expenses: ex, profit: rev - fe - sh - cg - ex });
    }
    const rows: (string | number | null | undefined)[][] = [
      ["Month", "Revenue (USD)", "Fees (USD)", "Shipping (USD)", "Expenses (USD)", "Profit (USD)"],
      ...monthly.map((m) => [m.month, MONEY(m.revenue), MONEY(m.fees), MONEY(m.shipping), MONEY(m.expenses), MONEY(m.profit)]),
      ["Total", MONEY(gross), MONEY(fees), MONEY(shipping), MONEY(expTotal), MONEY(profit)],
    ];
    return { title: `Yearly report — ${year}`, filename: `regroove-yearly-${year}.csv`, rows };
  }

  if (type === "tax") {
    const taxable = gross - cogs - fees - shipping - expTotal;
    const rows: (string | number | null | undefined)[][] = [
      ["Item", "Amount (USD)"],
      ["Gross sales", MONEY(gross)],
      ["Cost of goods sold", MONEY(cogs)],
      ["Marketplace & payment fees", MONEY(fees)],
      ["Shipping costs", MONEY(shipping)],
      ["Deductible expenses", MONEY(expTotal)],
      ["Estimated taxable income", MONEY(taxable)],
      [],
      ["Deductible expenses", ""],
      ["Category", "Total (USD)"],
      ...expensesByCategory(inExpenses).map((c) => [c.category, MONEY(c.total)]),
      [],
      ["Note", "Estimates only — confirm deductions with a tax professional."],
    ];
    return { title: `Tax summary — ${month.slice(0, 4)}`, filename: `regroove-tax-${month.slice(0, 4)}.csv`, rows };
  }

  if (type === "valuation") {
    const active = items.filter((i) => i.status !== "sold");
    const rows: (string | number | null | undefined)[][] = [
      ["SKU", "Name", "Brand", "Category", "Status", "Cost (USD)", "Asking (USD)", "Est. profit (USD)"],
      ...active.map((i) => [
        i.sku,
        i.name,
        i.brand,
        i.category,
        i.status,
        MONEY(i.purchasePrice),
        MONEY(i.listingPrice),
        MONEY(i.listingPrice - i.purchasePrice),
      ]),
      [
        "Total",
        "",
        "",
        "",
        "",
        MONEY(sumToNum(active.map((i) => i.purchasePrice))),
        MONEY(sumToNum(active.map((i) => i.listingPrice))),
        MONEY(sumToNum(active.map((i) => i.listingPrice - i.purchasePrice))),
      ],
    ];
    return { title: `Inventory valuation — ${label}`, filename: "regroove-inventory-valuation.csv", rows };
  }

  // top-sellers — join sold items with their sale records for true fee math.
  const sold = items
    .filter((i) => i.status === "sold")
    .map((i) => {
      const sale = sales.find((s) => s.itemId === i.id);
      const soldPrice = sale?.soldPrice ?? i.soldPrice ?? 0;
      const profit = sale?.profit ?? soldPrice - i.purchasePrice;
      return {
        name: i.name,
        brand: i.brand,
        category: i.category,
        soldDate: sale?.soldDate ?? i.soldDate ?? "",
        marketplace: i.soldOn ? MARKETPLACE_META[i.soldOn]?.name ?? i.soldOn : "",
        soldPrice,
        cost: i.purchasePrice,
        fees: sale?.fees ?? 0,
        shipping: sale?.shippingCost ?? 0,
        payout: sale?.payout ?? 0,
        profit,
      };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 100);
  const rows: (string | number | null | undefined)[][] = [
    ["Name", "Brand", "Category", "Sold date", "Marketplace", "Sold (USD)", "Cost (USD)", "Fees (USD)", "Shipping (USD)", "Payout (USD)", "Profit (USD)"],
    ...sold.map((i) => [
      i.name,
      i.brand,
      i.category,
      i.soldDate,
      i.marketplace,
      MONEY(i.soldPrice),
      MONEY(i.cost),
      MONEY(i.fees),
      MONEY(i.shipping),
      MONEY(i.payout),
      MONEY(i.profit),
    ]),
  ];
  return { title: "Top sellers (by profit)", filename: "regroove-top-sellers.csv", rows };
}

export default function Reports() {
  const { items, sales, expenses } = useData();
  const money = useMemo(() => computeMoneyKpis(sales, expenses), [sales, expenses]);
  const kpis = useMemo(() => computeInventoryKpis(items), [items]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    type: "pnl-monthly" as ReportType,
    month: monthInputValue(),
    format: "csv" as ReportFormat,
  });
  const [working, setWorking] = useState(false);

  const runReport = (type: ReportType, month: string, format: ReportFormat) => {
    setWorking(true);
    try {
      const report = buildReport(type, month, items, sales, expenses);
      if (format === "csv") {
        downloadCsv(report.filename, report.rows);
        toast("Report downloaded", { description: `${report.title} (CSV).` });
      } else {
        printReport(report.title, report.rows);
      }
    } catch (e) {
      toast.error("Couldn't generate the report", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setWorking(false);
    }
  };

  const REPORT_TYPES: {
    id: ReportType;
    title: string;
    description: string;
    icon: typeof FileBarChart;
    status: "Ready" | "Preview";
    tone: "success" | "warning";
    summary: string;
  }[] = [
    {
      id: "pnl-monthly",
      title: "Monthly P&L",
      description: "Revenue, expenses, fees, and profit for a single month.",
      icon: FileBarChart,
      status: "Ready",
      tone: "success",
      summary: `${usd(money.monthRevenue)} revenue · ${usd(money.monthExpenses)} expenses · ${usd(money.monthProfit)} profit`,
    },
    {
      id: "pnl-quarterly",
      title: "Quarterly summary",
      description: "Rolled-up performance with marketplace and category splits.",
      icon: CalendarRange,
      status: "Ready",
      tone: "success",
      summary: `${sales.length} sales on record · ${usd(money.totalExpenses)} expenses`,
    },
    {
      id: "yearly",
      title: "Yearly report",
      description: "Full-year performance, growth trends, and seasonality.",
      icon: TrendingUp,
      status: "Ready",
      tone: "success",
      summary: "Year-to-date · " + sales.length + " orders",
    },
    {
      id: "tax",
      title: "Tax summary",
      description: "Sales, COGS, and deductible expenses for tax time.",
      icon: Landmark,
      status: "Ready",
      tone: "success",
      summary: "Estimated taxable income this year",
    },
    {
      id: "valuation",
      title: "Inventory valuation",
      description: "Current stock valued at cost and at asking price.",
      icon: Package,
      status: "Ready",
      tone: "success",
      summary: `${kpis.inventoryCount} pieces · ${usd(kpis.inventoryValue)} at asking`,
    },
    {
      id: "top-sellers",
      title: "Top sellers",
      description: "Best-performing items, brands, and categories.",
      icon: FileSpreadsheet,
      status: "Ready",
      tone: "success",
      summary: "Denim and outerwear lead margins",
    },
  ];

  const selected = REPORT_TYPES.find((r) => r.id === form.type) ?? REPORT_TYPES[0];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate and download the summaries that keep your business on track."
        crumbs={[{ label: "Reports" }]}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Generate report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate a report</DialogTitle>
                <DialogDescription>
                  Download a CSV you can open in Excel/Sheets, or print to PDF.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Report type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm((f) => ({ ...f, type: v as ReportType }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Period</Label>
                    <Input
                      type="month"
                      value={form.month}
                      onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Format</Label>
                    <Select
                      value={form.format}
                      onValueChange={(v) => setForm((f) => ({ ...f, format: v as ReportFormat }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV (Excel / Sheets)</SelectItem>
                        <SelectItem value="pdf">PDF (print)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="rounded-md bg-muted/60 px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  {selected.description} Generated from your current inventory, sales, and
                  expenses.
                </p>
              </div>
              <DialogFooter>
                <Button
                  disabled={working}
                  onClick={() => {
                    runReport(form.type, form.month, form.format);
                    setDialogOpen(false);
                  }}
                >
                  {working ? "Generating…" : "Generate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORT_TYPES.map((r) => (
          <Card key={r.id} className="gap-0 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="flex-row items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <r.icon className="size-[18px]" />
              </span>
              <Badge variant={r.tone}>{r.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <CardTitle className="text-[15px]">{r.title}</CardTitle>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {r.description}
                </p>
              </div>
              <p className="rounded-md bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground">
                {r.summary}
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={working}
                  onClick={() => runReport(r.id, form.month, "pdf")}
                >
                  <Printer className="size-3.5" />
                  Print / PDF
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={working}
                  onClick={() => runReport(r.id, form.month, "csv")}
                >
                  <Download className="size-3.5" />
                  Download CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-[15px]">How reports work</CardTitle>
        </CardHeader>
        <CardContent className="">
          <p className="rounded-md bg-muted/60 px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
            Every report is generated on demand from your current inventory, sales, and
            expenses — nothing is stored. Download the CSV for spreadsheets, or print to
            PDF for a shareable copy. Periods use the month/year you pick; yearly and tax
            reports use that month's year.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
