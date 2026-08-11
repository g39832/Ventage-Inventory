import { useMemo, useState } from "react";
import {
  Banknote,
  Boxes,
  Pencil,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { TablePagination } from "@/components/common/TablePagination";
import { computeMoneyKpis, expensesByCategory } from "@/lib/data";
import { useData } from "@/lib/store";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
} from "@/lib/types";
import { daysAgoISO, formatDate, todayISO, usd } from "@/lib/format";
import { toast } from "sonner";

const PER_PAGE = 10;

const EMPTY_FORM = {
  description: "",
  amount: "",
  category: "Packaging & Supplies" as ExpenseCategory,
  date: todayISO(),
};

export default function Expenses() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  const breakdown = useMemo(() => expensesByCategory(expenses), [expenses]);
  const maxCategory = Math.max(...breakdown.map((b) => b.total), 1);
  const money = useMemo(() => computeMoneyKpis([], expenses), [expenses]);
  const sixMonthCutoff = daysAgoISO(180);
  const totalSixMonths = useMemo(
    () => expenses.filter((e) => e.date >= sixMonthCutoff).reduce((s, e) => s + e.amount, 0),
    [expenses, sixMonthCutoff]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (q && !e.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [expenses, search, category]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const hasFilters = search !== "" || category !== "all";

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      description: e.description,
      amount: String(e.amount),
      category: e.category,
      date: e.date,
    });
    setDialogOpen(true);
  };

  const submit = () => {
    const amount = Number(form.amount);
    if (!form.description.trim() || !amount || amount <= 0) {
      toast.error("Check the expense", {
        description: "A description and an amount above zero are required.",
      });
      return;
    }
    setSaving(true);
    const payload = {
      description: form.description.trim(),
      amount,
      category: form.category,
      date: form.date || todayISO(),
    };
    const done = (message: string) => {
      toast(message, { description: payload.description });
      setDialogOpen(false);
    };
    const fail = () =>
      toast.error("Couldn't save the expense", { description: "Please try again." });

    if (editing) {
      updateExpense(editing.id, payload)
        .then(() => done("Expense updated"))
        .catch(fail)
        .finally(() => setSaving(false));
    } else {
      addExpense(payload)
        .then(() => done("Expense logged"))
        .catch(fail)
        .finally(() => setSaving(false));
    }
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Every cost of doing business — shipping, sourcing, fees, and more."
        crumbs={[{ label: "Expenses" }]}
        actions={
          <Button onClick={openAdd}>
            <Plus className="size-4" />
            Log expense
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total (6 months)"
          value={usd(totalSixMonths)}
          delta={9}
          deltaLabel="vs previous period"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="This month"
          value={usd(money.monthExpenses)}
          delta={4}
          deltaLabel="vs last month"
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="Categories"
          value={String(breakdown.length)}
          icon={<Boxes className="size-4" />}
        />
        <StatCard
          label="Top category"
          value={breakdown[0]?.category.split(" ")[0] ?? "—"}
          icon={<ShoppingBag className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Category breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[15px]">By category</CardTitle>
          </CardHeader>
          <div className="space-y-4 px-6 pb-6">
            {breakdown.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                No expenses yet — log your first one above.
              </p>
            )}
            {breakdown.map((b) => (
              <div key={b.category}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-medium">
                    {b.category}
                    <span className="ml-1.5 text-[11.5px] text-muted-foreground">
                      {b.count} entries
                    </span>
                  </span>
                  <span className="font-semibold tabular">{usd(b.total)}</span>
                </div>
                <Progress value={(b.total / maxCategory) * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>

        {/* Expense table */}
        <Card className="gap-0 p-0! xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="relative min-w-44 flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search expenses…"
                className="pl-9"
              />
            </div>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
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
                  setPage(1);
                }}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-0!">
                    <EmptyState
                      icon={<Receipt className="size-5" />}
                      title="No expenses match"
                      description="Try a different search or category filter."
                    />
                  </TableCell>
                </TableRow>
              )}
              {pageItems.map((e) => (
                <TableRow key={e.id} className="group">
                  <TableCell className="text-[13px] text-muted-foreground tabular">
                    {formatDate(e.date)}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-[13.5px] font-medium">
                    {e.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {e.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-[13.5px] font-semibold tabular text-destructive">
                    −{usd(e.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => openEdit(e)}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit expense</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => setDeleteTarget(e)}
                      >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Delete expense</span>
                      </Button>
                    </div>
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

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Log an expense"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details of this expense."
                : "Record a business cost — it saves to your database."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Description *</Label>
              <Input
                placeholder="e.g. USPS Priority Mail — 4 packages"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Amount (USD) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as ExpenseCategory }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Log expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.description}” ({usd(deleteTarget?.amount ?? 0)}) will be
              removed from your records.
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
                deleteExpense(target.id)
                  .then(() => toast("Expense deleted", { description: target.description }))
                  .catch(() =>
                    toast.error("Couldn't delete expense", { description: "Please try again." })
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
