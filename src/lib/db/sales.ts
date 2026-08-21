import { db } from "@/lib/db/client";
import { listItems } from "@/lib/db/inventory";
import { mapSale, type SaleRow } from "@/lib/db/mappers";
import { dec, toNum } from "@/lib/money";
import type { MarketplaceId, Sale } from "@/lib/types";

export interface NewSaleInput {
  itemName: string;
  marketplace: MarketplaceId;
  soldDate: string;
  soldPrice: number;
  fees: number;
  shippingCost: number;
  costOfGoods?: number;
}

export async function listSales(): Promise<Sale[]> {
  try {
    const client = db();
    const { data: saleRows, error } = await client
      .from("sales")
      .select("*")
      .order("sold_date", { ascending: false });
    if (error) throw new Error(error.message);

    const items = await listItems();
    const byId = new Map(items.map((i) => [i.id, i]));

    return (saleRows ?? []).map((row, i) =>
      mapSale(row as SaleRow, i, row.item_id ? byId.get(row.item_id) : undefined)
    );
  } catch {
    return [];
  }
}

/** Create a standalone (non-inventory-linked) sale. */
export async function createSale(input: NewSaleInput): Promise<Sale> {
  const client = db();
  const payout = toNum(dec(input.soldPrice).minus(input.fees).minus(input.shippingCost));
  const profit = toNum(dec(payout).minus(input.costOfGoods ?? 0));

  const { data, error } = await client
    .from("sales")
    .insert({
      item_name: input.itemName.trim(),
      marketplace_id: input.marketplace,
      sold_date: input.soldDate,
      sold_price: input.soldPrice,
      fees: input.fees,
      shipping_cost: input.shippingCost,
      payout,
      profit,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  return mapSale(data as SaleRow, 0);
}
