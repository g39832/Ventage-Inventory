import type { Task } from "@/lib/types";

const iso = (daysFromNow: number): string => {
  const d = new Date(2026, 7, 6);
  d.setDate(d.getDate() + daysFromNow);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export const tasks: Task[] = [
  {
    id: "tsk-01",
    title: "Ship 4 orders before the 5 PM cutoff",
    due: iso(0),
    kind: "shipping",
    done: false,
  },
  {
    id: "tsk-02",
    title: "Photograph the new Carhartt lot (3 pcs)",
    due: iso(1),
    kind: "photo",
    done: false,
  },
  {
    id: "tsk-03",
    title: "Draft listing for Levi's 501 — add measurements",
    due: iso(1),
    kind: "listing",
    done: false,
  },
  {
    id: "tsk-04",
    title: "Repost 5 stale Depop listings",
    due: iso(2),
    kind: "listing",
    done: false,
  },
  {
    id: "tsk-05",
    title: "Source run: Saturday flea market",
    due: iso(4),
    kind: "sourcing",
    done: false,
  },
  {
    id: "tsk-06",
    title: "Respond to 2 offers on the Harley tee",
    due: iso(0),
    kind: "general",
    done: true,
  },
  {
    id: "tsk-07",
    title: "Update shipping profiles for weight changes",
    due: iso(3),
    kind: "general",
    done: true,
  },
];
