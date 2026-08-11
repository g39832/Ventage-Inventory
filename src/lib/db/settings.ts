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
