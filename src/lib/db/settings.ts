import { db, requireUserId } from "@/lib/db/client";

export interface ProfileSettings {
  displayName: string;
  email: string;
  shopName: string;
  phone: string;
}

export interface ShopSettings {
  currency: string;
  defaultMarketplace: string;
  salesTaxRate: string;
  shippingDefault: string;
  autoCalcProfit: boolean;
  suggestPrice: boolean;
}

export interface NotificationSettings {
  newSales: boolean;
  offers: boolean;
  lowStock: boolean;
  weeklyDigest: boolean;
  listingEnd: boolean;
}

export interface AppSettings {
  profile: ProfileSettings;
  shop: ShopSettings;
  notifications: NotificationSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  profile: {
    displayName: "Grayson R.",
    email: "",
    shopName: "Grayson's Vintage",
    phone: "",
  },
  shop: {
    currency: "USD",
    defaultMarketplace: "ebay",
    salesTaxRate: "0",
    shippingDefault: "8",
    autoCalcProfit: true,
    suggestPrice: true,
  },
  notifications: {
    newSales: true,
    offers: true,
    lowStock: true,
    weeklyDigest: false,
    listingEnd: true,
  },
};

export async function getSettings(): Promise<AppSettings> {
  const client = db();
  const ownerId = await requireUserId();
  const { data, error } = await client
    .from("app_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    // PGRST116 = row not found; everything else is a real failure.
    throw new Error(error.message);
  }
  if (data) {
    return {
      profile: { ...DEFAULT_SETTINGS.profile, ...(data.profile ?? {}) },
      shop: { ...DEFAULT_SETTINGS.shop, ...(data.shop ?? {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(data.notifications ?? {}) },
    };
  }
  // Seed the row on first use so saves have something to update.
  await client.from("app_settings").insert({ owner_id: ownerId, ...DEFAULT_SETTINGS });
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const client = db();
  const ownerId = await requireUserId();
  const { error } = await client
    .from("app_settings")
    .upsert({ owner_id: ownerId, ...settings }, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);
}

/**
 * Ask Ventage — bring-your-own-key support.
 *
 * The user's OpenAI key lives in the `ai` jsonb column of their own
 * app_settings row (RLS-scoped to owner_id = auth.uid()). The server reads
 * it with the user's token and uses it for their AI requests. The full key
 * is never displayed back in the UI — only its presence.
 */

/** True when the user has saved their own OpenAI key. */
export async function hasAiKey(): Promise<boolean> {
  const client = db();
  const ownerId = await requireUserId();
  const { data } = await client
    .from("app_settings")
    .select("ai")
    .eq("owner_id", ownerId)
    .maybeSingle();
  return typeof data?.ai?.openaiKey === "string" && data.ai.openaiKey.trim().length > 0;
}

/** Save the user's own OpenAI key. Requires the `ai` column (see setup SQL). */
export async function saveAiKey(openaiKey: string): Promise<void> {
  const client = db();
  const ownerId = await requireUserId();
  const { error } = await client
    .from("app_settings")
    .upsert({ owner_id: ownerId, ai: { openaiKey } }, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);
}

/** Remove the user's own key (Ask Ventage then falls back to the server key, if any). */
export async function clearAiKey(): Promise<void> {
  const client = db();
  const ownerId = await requireUserId();
  const { error } = await client
    .from("app_settings")
    .update({ ai: {} })
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}
