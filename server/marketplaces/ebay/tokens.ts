/**
 * Persistence for per-user eBay OAuth tokens.
 *
 * Rows live in `ebay_tokens`, keyed by owner_id and protected by RLS. The
 * server reads/writes them through the user-scoped Supabase client (the
 * user's own session token), so a user can only ever touch their own row.
 * The browser never sees these tokens.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshTokens } from "./oauth.js";

export interface EbayTokenRecord {
  ownerId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
  ebayUsername: string | null;
  paymentPolicyId: string | null;
  returnPolicyId: string | null;
  fulfillmentPolicyId: string | null;
  categoryId: string;
}

interface TokenRow {
  owner_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  ebay_username: string | null;
  payment_policy_id: string | null;
  return_policy_id: string | null;
  fulfillment_policy_id: string | null;
  category_id: string | null;
}

function mapRow(row: TokenRow): EbayTokenRecord {
  return {
    ownerId: row.owner_id,
    accessToken: row.access_token ?? "",
    refreshToken: row.refresh_token ?? "",
    expiresAt: row.expires_at ?? null,
    ebayUsername: row.ebay_username ?? null,
    paymentPolicyId: row.payment_policy_id ?? null,
    returnPolicyId: row.return_policy_id ?? null,
    fulfillmentPolicyId: row.fulfillment_policy_id ?? null,
    categoryId: row.category_id ?? "15687",
  };
}

export async function getTokenRecord(
  client: SupabaseClient,
  userId: string
): Promise<EbayTokenRecord | null> {
  const { data } = await client
    .from("ebay_tokens")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data) return null;
  return mapRow(data as TokenRow);
}

export async function saveTokenRecord(
  client: SupabaseClient,
  userId: string,
  record: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string | null;
    ebayUsername: string | null;
  }
): Promise<void> {
  const { error } = await client.from("ebay_tokens").upsert(
    {
      owner_id: userId,
      access_token: record.accessToken,
      refresh_token: record.refreshToken,
      expires_at: record.expiresAt,
      ebay_username: record.ebayUsername,
    },
    { onConflict: "owner_id" }
  );
  if (error) throw new Error(error.message);
}

export async function patchTokenRecord(
  client: SupabaseClient,
  userId: string,
  patch: Partial<{
    accessToken: string;
    refreshToken: string;
    expiresAt: string | null;
    ebayUsername: string | null;
    paymentPolicyId: string | null;
    returnPolicyId: string | null;
    fulfillmentPolicyId: string | null;
    categoryId: string;
  }>
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.accessToken !== undefined) update.access_token = patch.accessToken;
  if (patch.refreshToken !== undefined) update.refresh_token = patch.refreshToken;
  if (patch.expiresAt !== undefined) update.expires_at = patch.expiresAt;
  if (patch.ebayUsername !== undefined) update.ebay_username = patch.ebayUsername;
  if (patch.paymentPolicyId !== undefined) update.payment_policy_id = patch.paymentPolicyId;
  if (patch.returnPolicyId !== undefined) update.return_policy_id = patch.returnPolicyId;
  if (patch.fulfillmentPolicyId !== undefined) update.fulfillment_policy_id = patch.fulfillmentPolicyId;
  if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
  if (Object.keys(update).length === 0) return;
  const { error } = await client
    .from("ebay_tokens")
    .update(update)
    .eq("owner_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteTokenRecord(
  client: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await client.from("ebay_tokens").delete().eq("owner_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * A usable access token for the user — refreshing from the stored refresh
 * token when the current one is expired or missing. Throws a user-safe
 * error when there's no connection to refresh from.
 */
export async function withValidAccessToken(
  client: SupabaseClient,
  userId: string
): Promise<{ accessToken: string; record: EbayTokenRecord }> {
  const record = await getTokenRecord(client, userId);
  if (!record || !record.refreshToken) {
    throw new Error("Connect your eBay account first (Marketplace connections).");
  }

  const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : 0;
  const stillValid = record.accessToken && expiresAt > Date.now() + 60_000;
  if (stillValid) return { accessToken: record.accessToken, record };

  // Expired (or close to it) — refresh and persist.
  const refreshed = await refreshTokens(record.refreshToken);
  const next = {
    accessToken: refreshed.access_token,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    // eBay only returns a new refresh token on the FIRST exchange; keep the old one.
    refreshToken: refreshed.refresh_token ?? record.refreshToken,
  };
  await patchTokenRecord(client, userId, next);
  return { accessToken: next.accessToken, record };
}
