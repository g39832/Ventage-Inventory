import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
  iconClass,
  spark,
  className,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon?: ReactNode;
  iconClass?: string;
  spark?: { date: string; value: number }[];
  className?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  const sparkId = `spark-${label.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <Card className={cn("gap-0 p-0 py-0", className)}>
      <div className="flex items-start justify-between px-5 pt-5">
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="text-[28px] leading-none font-semibold tracking-tight tabular">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border bg-secondary/60 text-secondary-foreground",
              iconClass
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-5 pt-2.5">
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold tabular",
              positive ? "text-success" : "text-destructive"
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
        {deltaLabel && (
          <span className="text-xs text-muted-foreground">{deltaLabel}</span>
        )}
      </div>
      {spark && spark.length > 0 && (
        <div className="mt-2 h-10 w-full px-2 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-chart-1)"
                strokeWidth={1.5}
                fill={`url(#${sparkId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
