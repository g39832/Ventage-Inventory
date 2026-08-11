import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TablePagination({
  page,
  pageCount,
  total,
  perPage,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const visible =
    pageCount <= 7
      ? pages
      : Array.from(
          new Set([1, 2, page - 1, page, page + 1, pageCount - 1, pageCount])
        )
          .filter((p) => p >= 1 && p <= pageCount)
          .sort((a, b) => a - b);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-6 py-3",
        className
      )}
    >
      <p className="text-[13px] text-muted-foreground tabular">
        Showing <span className="font-medium text-foreground">{from}–{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {visible.map((p, i) => {
          const prev = visible[i - 1];
          const gap = prev !== undefined && p - prev > 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {gap && <span className="px-1 text-muted-foreground">…</span>}
              <Button
                variant={p === page ? "default" : "outline"}
                size="icon"
                className="size-8 text-[13px]"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            </span>
          );
        })}
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
