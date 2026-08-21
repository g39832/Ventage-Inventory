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
  try {
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
    // If the users row was cleaned up, fetchProfile() already recreated it.
    const { error: insertErr } = await client
      .from("app_settings")
      .insert({ owner_id: ownerId, ...DEFAULT_SETTINGS });
    if (insertErr) {
      // FK violation — users row may still be missing. Return defaults.
      console.warn("[settings] insert failed:", insertErr.message);
    }
    return DEFAULT_SETTINGS;
  } catch {
    // Table may not exist yet or have schema differences — safe fallback.
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const client = db();
    const ownerId = await requireUserId();
    const { error } = await client
      .from("app_settings")
      .upsert({ owner_id: ownerId, ...settings }, { onConflict: "owner_id" });
    if (error) {
      // FK violation: users row may be missing (e.g. after database cleanup).
      // Recreate the profile row and retry.
      if (/foreign key/i.test(error.message)) {
        const { data: authUser } = await client.auth.getUser();
        if (authUser?.user) {
          const meta = authUser.user.user_metadata ?? {};
          await client.from("users").upsert(
            {
              id: ownerId,
              email: authUser.user.email ?? "",
              display_name:
                String(meta.display_name ?? meta.full_name ?? meta.name ?? "") ||
                (authUser.user.email ?? "User").split("@")[0],
              avatar_url: String(meta.avatar_url ?? meta.picture ?? "") || undefined,
            },
            { onConflict: "id" }
          );
          // Retry the settings save.
          const { error: retryErr } = await client
            .from("app_settings")
            .upsert({ owner_id: ownerId, ...settings }, { onConflict: "owner_id" });
          if (retryErr) console.warn("[settings] retry failed:", retryErr.message);
        }
      } else {
        console.warn("[settings] saveSettings failed:", error.message);
      }
    }
  } catch (e) {
    // If settings can't be persisted (table missing, schema mismatch),
    // silently succeed — the in-memory state is still updated.
    console.warn("[settings] saveSettings failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Ask Regroove — bring-your-own-key support.
 *
 * The user's OpenAI key lives in the `ai` jsonb column of their own
 * app_settings row (RLS-scoped to owner_id = auth.uid()). The server reads
 * it with the user's token and uses it for their AI requests. The full key
 * is never displayed back in the UI — only its presence.
 */

/** True when the user has saved their own OpenAI key. */
export async function hasAiKey(): Promise<boolean> {
  try {
    const client = db();
    const ownerId = await requireUserId();
    const { data } = await client
      .from("app_settings")
      .select("ai")
      .eq("owner_id", ownerId)
      .maybeSingle();
    return typeof data?.ai?.openaiKey === "string" && data.ai.openaiKey.trim().length > 0;
  } catch {
    return false;
  }
}

/** Save the user's own OpenAI key. Requires the `ai` column (see setup SQL). */
export async function saveAiKey(openaiKey: string): Promise<void> {
  try {
    const client = db();
    const ownerId = await requireUserId();
    const { error } = await client
      .from("app_settings")
      .upsert({ owner_id: ownerId, ai: { openaiKey } }, { onConflict: "owner_id" });
    if (error) throw new Error(error.message);
  } catch (e) {
    throw new Error("Couldn't save the AI key. The settings table may need to be updated.");
  }
}

/** Remove the user's own key (Ask Regroove then falls back to the server key, if any). */
export async function clearAiKey(): Promise<void> {
  try {
    const client = db();
    const ownerId = await requireUserId();
    const { error } = await client
      .from("app_settings")
      .update({ ai: {} })
      .eq("owner_id", ownerId);
    if (error) throw new Error(error.message);
  } catch (e) {
    throw new Error("Couldn't clear the AI key. The settings table may need to be updated.");
  }
}
