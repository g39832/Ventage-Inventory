import { useMemo, useState } from "react";
import {
  CalendarRange,
  Download,
  Eye,
  FileBarChart,
  FileSpreadsheet,
  Landmark,
  Package,
  Plus,
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
import { computeInventoryKpis, computeMoneyKpis } from "@/lib/data";
import { useData } from "@/lib/store";
import { monthInputValue, usd } from "@/lib/format";
import { toast } from "sonner";

export default function Reports() {
  const { items, sales, expenses } = useData();
  const money = useMemo(() => computeMoneyKpis(sales, expenses), [sales, expenses]);
  const kpis = useMemo(() => computeInventoryKpis(items), [items]);
  const [form, setForm] = useState({
    type: "pnl-monthly",
    month: monthInputValue(),
    format: "PDF",
  });

  const REPORT_TYPES = [
    {
      id: "pnl-monthly",
      title: "Monthly P&L",
      description: "Revenue, expenses, fees, and profit for a single month.",
      icon: FileBarChart,
      status: "Ready",
      tone: "success" as const,
      summary: `${usd(money.monthRevenue)} revenue · ${usd(money.monthExpenses)} expenses · ${usd(money.monthProfit)} profit`,
    },
    {
      id: "pnl-quarterly",
      title: "Quarterly summary",
      description: "Rolled-up performance with marketplace and category splits.",
      icon: CalendarRange,
      status: "Ready",
      tone: "success" as const,
      summary: `${sales.length} sales on record · ${usd(money.totalExpenses)} expenses`,
    },
    {
      id: "yearly",
      title: "Yearly report",
      description: "Full-year performance, growth trends, and seasonality.",
      icon: TrendingUp,
      status: "Preview",
      tone: "warning" as const,
      summary: "Year-to-date · " + sales.length + " orders",
    },
    {
      id: "tax",
      title: "Tax summary",
      description: "Sales, COGS, and deductible expenses for tax time.",
      icon: Landmark,
      status: "Draft",
      tone: "warning" as const,
      summary: "Estimated taxable income this year",
    },
    {
      id: "valuation",
      title: "Inventory valuation",
      description: "Current stock valued at cost and at asking price.",
      icon: Package,
      status: "Ready",
      tone: "success" as const,
      summary: `${kpis.inventoryCount} pieces · ${usd(kpis.inventoryValue)} at asking`,
    },
    {
      id: "top-sellers",
      title: "Top sellers",
      description: "Best-performing items, brands, and categories.",
      icon: FileSpreadsheet,
      status: "Ready",
      tone: "success" as const,
      summary: "Denim and outerwear lead margins",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate and download the summaries that keep your business on track."
        crumbs={[{ label: "Reports" }]}
        actions={
          <Dialog>
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
                  Report generation is coming in Phase 7 — for now this previews
                  what will be available.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Report type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pnl-monthly">Monthly P&L</SelectItem>
                      <SelectItem value="pnl-quarterly">Quarterly summary</SelectItem>
                      <SelectItem value="yearly">Yearly report</SelectItem>
                      <SelectItem value="tax">Tax summary</SelectItem>
                      <SelectItem value="valuation">Inventory valuation</SelectItem>
                      <SelectItem value="top-sellers">Top sellers</SelectItem>
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
                    <Select value={form.format} onValueChange={(v) => setForm((f) => ({ ...f, format: v }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="CSV">CSV</SelectItem>
                        <SelectItem value="XLSX">XLSX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() =>
                    toast("Coming in Phase 7", {
                      description: `PDF/CSV export for ${form.type} arrives in a later phase.`,
                    })
                  }
                >
                  Generate
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
                  onClick={() =>
                    toast("Coming in Phase 7", {
                      description: `${r.title} preview and export arrive in a later phase.`,
                    })
                  }
                >
                  <Eye className="size-3.5" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    toast("Coming in Phase 7", {
                      description: `${r.title} export arrives in a later phase.`,
                    })
                  }
                >
                  <Download className="size-3.5" />
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-[15px]">Recent reports</CardTitle>
        </CardHeader>
        <CardContent className="">
          <div className="divide-y">
            <p className="rounded-md bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground">
              Generated reports will be listed here once export ships in Phase 7.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
