import { format, parseISO } from "date-fns";

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdWholeFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdCompactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function usd(n: number): string {
  return usdFull.format(n);
}

export function usdWhole(n: number): string {
  return usdWholeFormatter.format(n);
}

export function usdCompact(n: number): string {
  return usdCompactFormatter.format(n);
}

export function percent(n: number): string {
  return pct.format(n);
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy");
}

export function formatShortDate(iso: string): string {
  return format(parseISO(iso), "MMM d");
}

/** Turn "2026-08-06" into "Aug 6" for compact tables. */
export function monthLabel(iso: string): string {
  return format(parseISO(iso), "MMM yyyy");
}

/* ── Date helpers (the app always works against the real current date) ── */

/** Format a Date as an ISO date string (YYYY-MM-DD) in local time. */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** ISO date N days before `from` (defaults to now). */
export function daysAgoISO(days: number, from = new Date()): string {
  return toISODate(new Date(from.getFullYear(), from.getMonth(), from.getDate() - days));
}

/** ISO date N days after `from` (defaults to now). */
export function daysFromNowISO(days: number, from = new Date()): string {
  return toISODate(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
}

/** "12m ago", "Yesterday", "3 days ago"… for sync timestamps. */
export function formatLastSync(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return format(then, "MMM d");
}

/** "2026-08" for <input type="month"> defaults. */
export function monthInputValue(d = new Date()): string {
  return format(d, "yyyy-MM");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
