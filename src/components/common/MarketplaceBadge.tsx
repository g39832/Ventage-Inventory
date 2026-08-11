import { cn } from "@/lib/utils";
import type { MarketplaceId } from "@/lib/types";
import { MARKETPLACE_META } from "@/lib/mock/marketplaces";

export function MarketplaceBadge({
  id,
  status,
  className,
}: {
  id: MarketplaceId;
  status?: "live" | "sold" | "none";
  className?: string;
}) {
  const meta = MARKETPLACE_META[id];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        className
      )}
      style={{ color: meta.color, borderColor: `${meta.color}40`, background: meta.bg }}
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.name}
      {status === "live" && (
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          Live
        </span>
      )}
      {status === "sold" && (
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          Sold
        </span>
      )}
    </span>
  );
}
