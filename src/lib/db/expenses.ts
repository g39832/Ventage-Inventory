import { db } from "@/lib/db/client";
import { mapExpense, type ExpenseRow } from "@/lib/db/mappers";
import type { Expense, ExpenseCategory } from "@/lib/types";

export interface ExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
}

export interface ExpensePatch {
  category?: ExpenseCategory;
  description?: string;
  amount?: number;
  date?: string;
}

export async function listExpenses(): Promise<Expense[]> {
  try {
    const client = db();
    const { data, error } = await client
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapExpense(row as ExpenseRow));
  } catch {
    return [];
  }
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const client = db();
  const { data, error } = await client
    .from("expenses")
    .insert({
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      date: input.date,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapExpense(data as ExpenseRow);
}

export async function updateExpense(id: string, patch: ExpensePatch): Promise<void> {
  const client = db();
  const update: Record<string, unknown> = {};
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.description !== undefined) update.description = patch.description.trim();
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.date !== undefined) update.date = patch.date;
  const { error } = await client.from("expenses").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeExpense(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
