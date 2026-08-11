import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { friendlyError, isSupabaseConfigured } from "@/lib/db/client";
import * as connectionsService from "@/lib/db/connections";
import type { ConnectionPatch } from "@/lib/db/connections";
import * as expensesService from "@/lib/db/expenses";
import type { ExpenseInput, ExpensePatch } from "@/lib/db/expenses";
import * as inventoryService from "@/lib/db/inventory";
import type {
  ItemExpenseInput,
  ItemPatch,
  MarkSoldInput,
  NewItemInput,
} from "@/lib/db/inventory";
import * as photosService from "@/lib/db/photos";
import * as salesService from "@/lib/db/sales";
import type { NewSaleInput } from "@/lib/db/sales";
import * as settingsService from "@/lib/db/settings";
import type { AppSettings } from "@/lib/db/settings";
import * as tasksService from "@/lib/db/tasks";
import { liveListingsOn } from "@/lib/data";
import type {
  Expense,
  Item,
  ItemPhoto,
  MarketplaceConnection,
  MarketplaceId,
  Sale,
  Task,
} from "@/lib/types";

type DataStatus = "not-configured" | "loading" | "ready" | "error";

interface DataContextValue {
  status: DataStatus;
  error: string | null;
  retry: () => void;
  items: Item[];
  sales: Sale[];
  expenses: Expense[];
  tasks: Task[];
  connections: MarketplaceConnection[];
  settings: AppSettings;
  /** Uploaded photos grouped by item id (sorted by position). */
  photosByItem: Record<string, ItemPhoto[]>;
  // Mutations (each persists to Supabase, then updates local state)
  createItem: (input: NewItemInput) => Promise<Item>;
  updateItem: (id: string, patch: ItemPatch) => Promise<void>;
  archiveItem: (id: string) => Promise<void>;
  markSold: (item: Item, input: MarkSoldInput) => Promise<void>;
  addNote: (itemId: string, note: string) => Promise<void>;
  addTimelineNote: (itemId: string, note: string) => Promise<void>;
  setListingStatus: (item: Item, marketplaceId: MarketplaceId, status: "live" | "none") => Promise<void>;
  addItemExpense: (item: Item, input: ItemExpenseInput) => Promise<void>;
  addExpense: (input: ExpenseInput) => Promise<void>;
  updateExpense: (id: string, patch: ExpensePatch) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addSale: (input: NewSaleInput) => Promise<void>;
  toggleTask: (task: Task) => Promise<void>;
  connectMarketplace: (id: MarketplaceId, patch: ConnectionPatch) => Promise<void>;
  disconnectMarketplace: (id: MarketplaceId) => Promise<void>;
  syncMarketplace: (id: MarketplaceId) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  // Photo mutations
  addPhoto: (itemId: string, file: File) => Promise<ItemPhoto>;
  removePhoto: (photo: ItemPhoto) => Promise<void>;
  movePhoto: (itemId: string, photoId: string, direction: -1 | 1) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

/** Group flat photo rows by item, sorted by position. */
function groupPhotos(photos: ItemPhoto[]): Record<string, ItemPhoto[]> {
  const map: Record<string, ItemPhoto[]> = {};
  for (const p of photos) {
    (map[p.itemId] ??= []).push(p);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.position - b.position);
  }
  return map;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DataStatus>(
    isSupabaseConfigured ? "loading" : "not-configured"
  );
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [settings, setSettings] = useState<AppSettings>(settingsService.DEFAULT_SETTINGS);
  const [photos, setPhotos] = useState<ItemPhoto[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setStatus("not-configured");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const [itemList, saleList, expenseList, taskList, connectionList, appSettings, photoList] =
        await Promise.all([
          inventoryService.listItems(),
          salesService.listSales(),
          expensesService.listExpenses(),
          tasksService.listTasks(),
          connectionsService.listConnections(),
          settingsService.getSettings(),
          photosService.listPhotos(),
        ]);
      const withListings = connectionList.map((c) => ({
        ...c,
        listings: liveListingsOn(itemList, c.id),
      }));
      setItems(itemList);
      setSales(saleList);
      setExpenses(expenseList);
      setTasks(taskList);
      setConnections(withListings);
      setSettings(appSettings);
      setPhotos(photoList);
      setStatus("ready");
    } catch (e) {
      setError(friendlyError(e));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const photosByItem = useMemo(() => groupPhotos(photos), [photos]);

  const createItem = useCallback(async (input: NewItemInput) => {
    const item = await inventoryService.createItem(input);
    setItems((prev) => [item, ...prev]);
    return item;
  }, []);

  const updateItem = useCallback(async (id: string, patch: ItemPatch) => {
    const updated = await inventoryService.updateItem(id, patch);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }, []);

  const archiveItem = useCallback(async (id: string) => {
    await inventoryService.archiveItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const markSold = useCallback(async (item: Item, input: MarkSoldInput) => {
    const { item: updated, sale } = await inventoryService.markSold(item, input);
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSales((prev) => [
      { ...sale, thumbnail: item.images[0] ?? sale.thumbnail },
      ...prev,
    ]);
  }, []);

  const addNote = useCallback(async (itemId: string, note: string) => {
    await inventoryService.addNote(itemId, note);
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, notes: [...i.notes, note.trim()], timeline: [...i.timeline, { date: new Date().toISOString().slice(0, 10), title: "Note added", description: note.trim(), kind: "note" as const }] }
          : i
      )
    );
  }, []);

  const addTimelineNote = useCallback(async (itemId: string, note: string) => {
    await inventoryService.addTimelineNote(itemId, note);
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, timeline: [...i.timeline, { date: new Date().toISOString().slice(0, 10), title: "Timeline note", description: note.trim(), kind: "note" as const }] }
          : i
      )
    );
  }, []);

  const setListingStatus = useCallback(
    async (item: Item, marketplaceId: MarketplaceId, status: "live" | "none") => {
      const updated = await inventoryService.setListingStatus(item, marketplaceId, status);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setConnections((prev) =>
        prev.map((c) =>
          c.id === marketplaceId ? { ...c, listings: liveListingsOn([...items.filter((i) => i.id !== updated.id), updated], marketplaceId) } : c
        )
      );
    },
    [items]
  );

  const addItemExpense = useCallback(async (item: Item, input: ItemExpenseInput) => {
    const expense = await inventoryService.addItemExpense(item, input);
    setExpenses((prev) => [expense, ...prev]);
  }, []);

  const addExpense = useCallback(async (input: ExpenseInput) => {
    const expense = await expensesService.createExpense(input);
    setExpenses((prev) => [expense, ...prev]);
  }, []);

  const updateExpense = useCallback(async (id: string, patch: ExpensePatch) => {
    await expensesService.updateExpense(id, patch);
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    await expensesService.removeExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addSale = useCallback(async (input: NewSaleInput) => {
    const sale = await salesService.createSale(input);
    setSales((prev) => [sale, ...prev]);
  }, []);

  const toggleTask = useCallback(async (task: Task) => {
    const next = !task.done;
    // Optimistic flip so the dashboard feels instant; revert on failure.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: next } : t)));
    try {
      await tasksService.setTaskDone(task.id, next);
    } catch (e) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
      throw e;
    }
  }, []);

  const connectMarketplace = useCallback(async (id: MarketplaceId, patch: ConnectionPatch) => {
    const updated = await connectionsService.updateConnection(id, patch);
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
  }, []);

  const disconnectMarketplace = useCallback(async (id: MarketplaceId) => {
    const updated = await connectionsService.updateConnection(id, {
      status: "not-connected",
      account: null,
    });
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
  }, []);

  const syncMarketplace = useCallback(async (id: MarketplaceId) => {
    const updated = await connectionsService.touchSync(id);
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
  }, []);

  const saveSettings = useCallback(async (next: AppSettings) => {
    await settingsService.saveSettings(next);
    setSettings(next);
  }, []);

  // ── Photo mutations ──────────────────────────────────────────

  // Ref mirrors the photos state so a batch of sequential uploads each
  // observe the position written by the previous one (state updates are
  // async, so the closure value would otherwise stay stale mid-loop).
  const photosRef = useRef<ItemPhoto[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const addPhoto = useCallback(async (itemId: string, file: File) => {
    const position = photosRef.current.filter((p) => p.itemId === itemId).length;
    const photo = await photosService.uploadItemPhoto(itemId, file, position);
    photosRef.current = [...photosRef.current, photo];
    setPhotos((prev) => [...prev, photo]);
    return photo;
  }, []);

  const removePhoto = useCallback(async (photo: ItemPhoto) => {
    await photosService.deleteItemPhoto(photo.id, photo.url);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }, []);

  const movePhoto = useCallback(
    async (itemId: string, photoId: string, direction: -1 | 1) => {
      const itemPhotos = photos
        .filter((p) => p.itemId === itemId)
        .sort((a, b) => a.position - b.position);
      const index = itemPhotos.findIndex((p) => p.id === photoId);
      const neighbor = itemPhotos[index + direction];
      if (index === -1 || !neighbor) return;
      const a = itemPhotos[index];
      const b = neighbor;
      await photosService.setPhotoPosition(a.id, b.position);
      await photosService.setPhotoPosition(b.id, a.position);
      setPhotos((prev) =>
        prev.map((p) => {
          if (p.id === a.id) return { ...p, position: b.position };
          if (p.id === b.id) return { ...p, position: a.position };
          return p;
        })
      );
    },
    [photos]
  );

  const value = useMemo<DataContextValue>(() => {
    // Surface real photos as the item's images (placeholders stay as fallback).
    const itemsWithPhotos = items.map((it) => {
      const list = photosByItem[it.id];
      return list && list.length > 0 ? { ...it, images: list.map((p) => p.url) } : it;
    });
    const salesWithThumbs = sales.map((s) =>
      s.itemId && photosByItem[s.itemId]?.length
        ? { ...s, thumbnail: photosByItem[s.itemId][0].url }
        : s
    );
    return {
      status,
      error,
      retry: refresh,
      items: itemsWithPhotos,
      sales: salesWithThumbs,
      expenses,
      tasks,
      connections,
      settings,
      photosByItem,
      createItem,
      updateItem,
      archiveItem,
      markSold,
      addNote,
      addTimelineNote,
      setListingStatus,
      addItemExpense,
      addExpense,
      updateExpense,
      deleteExpense,
      addSale,
      toggleTask,
      connectMarketplace,
      disconnectMarketplace,
      syncMarketplace,
      saveSettings,
      addPhoto,
      removePhoto,
      movePhoto,
    };
  }, [
    status,
    error,
    refresh,
    items,
    sales,
    expenses,
    tasks,
    connections,
    settings,
    photosByItem,
    createItem,
    updateItem,
    archiveItem,
    markSold,
    addNote,
    addTimelineNote,
    setListingStatus,
    addItemExpense,
    addExpense,
    updateExpense,
    deleteExpense,
    addSale,
    toggleTask,
    connectMarketplace,
    disconnectMarketplace,
    syncMarketplace,
    saveSettings,
    addPhoto,
    removePhoto,
    movePhoto,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>.");
  return ctx;
}
