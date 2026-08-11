import { Badge } from "@/components/ui/badge";
import type { ItemStatus } from "@/lib/types";

const STATUS_MAP: Record<
  ItemStatus,
  { label: string; variant: "success" | "warning" | "clay" | "muted" }
> = {
  listed: { label: "Listed", variant: "success" },
  draft: { label: "Draft", variant: "warning" },
  sold: { label: "Sold", variant: "clay" },
  unlisted: { label: "Unlisted", variant: "muted" },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const { label, variant } = STATUS_MAP[status];
  return (
    <Badge variant={variant} className="gap-1.5">
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
