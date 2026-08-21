import { db, requireUserId } from "@/lib/db/client";
import {
  mapConnection,
  type ConnectionRow,
  type MarketplaceRow,
} from "@/lib/db/mappers";
import type { MarketplaceConnection, MarketplaceId } from "@/lib/types";

export interface ConnectionPatch {
  status?: "connected" | "manual" | "not-connected";
  account?: string | null;
  syncType?: "auto" | "manual";
}

export async function listConnections(): Promise<MarketplaceConnection[]> {
  try {
    const client = db();
    const [{ data: marketplaces, error: mpErr }, { data: connections, error: connErr }] =
      await Promise.all([
        client.from("marketplaces").select("*").order("sort_order", { ascending: true }),
        client.from("marketplace_connections").select("*"),
      ]);
    if (mpErr) throw new Error(mpErr.message);
    if (connErr) throw new Error(connErr.message);

    const connByMarket = new Map<string, ConnectionRow>();
    for (const c of (connections ?? []) as ConnectionRow[]) {
      connByMarket.set(c.marketplace_id, c);
    }

    return ((marketplaces ?? []) as MarketplaceRow[]).map((mp) =>
      mapConnection(mp, connByMarket.get(mp.id))
    );
  } catch {
    return [];
  }
}

export async function updateConnection(
  marketplaceId: MarketplaceId,
  patch: ConnectionPatch
): Promise<MarketplaceConnection> {
  const client = db();
  const ownerId = await requireUserId();
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.account !== undefined) update.account = patch.account;
  if (patch.syncType !== undefined) update.sync_type = patch.syncType;

  await client
    .from("marketplace_connections")
    .upsert(
      { owner_id: ownerId, marketplace_id: marketplaceId, ...update },
      { onConflict: "owner_id,marketplace_id" }
    );

  return refreshConnection(ownerId, marketplaceId);
}

/** Record a manual sync — just refreshes the last_sync timestamp. */
export async function touchSync(marketplaceId: MarketplaceId): Promise<MarketplaceConnection> {
  const client = db();
  const ownerId = await requireUserId();
  await client
    .from("marketplace_connections")
    .upsert(
      { owner_id: ownerId, marketplace_id: marketplaceId, last_sync: new Date().toISOString() },
      { onConflict: "owner_id,marketplace_id" }
    );
  return refreshConnection(ownerId, marketplaceId);
}

async function refreshConnection(
  ownerId: string,
  marketplaceId: MarketplaceId
): Promise<MarketplaceConnection> {
  const client = db();
  const { data: mp, error: mpErr } = await client
    .from("marketplaces")
    .select("*")
    .eq("id", marketplaceId)
    .single();
  if (mpErr) throw new Error(mpErr.message);
  const { data: conn } = await client
    .from("marketplace_connections")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("marketplace_id", marketplaceId)
    .maybeSingle();
  return mapConnection(mp as MarketplaceRow, (conn as ConnectionRow | null) ?? undefined);
}
