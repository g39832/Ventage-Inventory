/**
 * Parses natural-language date ranges ("this month", "last 30 days", ...)
 * into real calendar/rolling windows so sales and expenses are filtered by
 * the dates the user actually asked about — never by "most recent N rows".
 */

export interface DateWindow {
  /** Human label, e.g. "this month". */
  label: string;
  /** Inclusive start (yyyy-mm-dd). */
  start: string;
  /** Inclusive end (yyyy-mm-dd). */
  end: string;
}

const iso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Local midnight of today — all windows are computed from here. */
const startOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const addDays = (d: Date, n: number): Date => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

/** Monday of the week containing d (weeks start Monday). */
const startOfWeek = (d: Date): Date => {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 = Sunday
  return addDays(copy, day === 0 ? -6 : 1 - day);
};

const startOfQuarter = (d: Date): Date => {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
};

export function parseDateWindow(message: string): DateWindow | null {
  const m = message.toLowerCase();
  const today = startOfToday();
  const end = iso(today);

  const dayWindow = (days: number, label: string): DateWindow => ({
    label,
    start: iso(addDays(today, -(days - 1))),
    end,
  });

  if (/\btoday\b/.test(m)) return { label: "today", start: end, end };
  if (/\bthis week\b/.test(m)) {
    return { label: "this week", start: iso(startOfWeek(today)), end };
  }
  if (/\blast week\b/.test(m)) {
    const monday = startOfWeek(today);
    return {
      label: "last week",
      start: iso(addDays(monday, -7)),
      end: iso(addDays(monday, -1)),
    };
  }
  if (/\bthis month\b/.test(m)) {
    return {
      label: "this month",
      start: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
      end,
    };
  }
  if (/\blast month\b/.test(m)) {
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      label: "last month",
      start: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      end: iso(addDays(firstOfThisMonth, -1)),
    };
  }
  if (/\bthis quarter\b/.test(m)) {
    return { label: "this quarter", start: iso(startOfQuarter(today)), end };
  }
  if (/\blast quarter\b/.test(m)) {
    const qStart = startOfQuarter(today);
    const prevQStart = new Date(qStart.getFullYear(), qStart.getMonth() - 3, 1);
    return {
      label: "last quarter",
      start: iso(prevQStart),
      end: iso(addDays(qStart, -1)),
    };
  }
  if (/\bthis year\b/.test(m)) {
    return { label: "this year", start: iso(new Date(today.getFullYear(), 0, 1)), end };
  }
  if (/\blast year\b/.test(m)) {
    return {
      label: "last year",
      start: iso(new Date(today.getFullYear() - 1, 0, 1)),
      end: iso(new Date(today.getFullYear() - 1, 11, 31)),
    };
  }

  const days = m.match(/\b(\d+)\s+days?\b/);
  if (days) return dayWindow(Number(days[1]), `last ${days[1]} days`);

  const weeks = m.match(/\b(\d+)\s+weeks?\b/);
  if (weeks) {
    const n = Number(weeks[1]);
    return dayWindow(n * 7, `last ${n} weeks`);
  }

  const months = m.match(/\b(\d+)\s+months?\b/);
  if (months) {
    const n = Number(months[1]);
    return {
      label: `last ${n} months`,
      start: iso(new Date(today.getFullYear(), today.getMonth() - n, 1)),
      end,
    };
  }

  return null;
}
