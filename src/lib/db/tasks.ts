import { db } from "@/lib/db/client";
import { mapTask, type TaskRow } from "@/lib/db/mappers";
import type { Task } from "@/lib/types";

export async function listTasks(): Promise<Task[]> {
  const client = db();
  const { data, error } = await client.from("tasks").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTask(row as TaskRow));
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const client = db();
  const { error } = await client.from("tasks").update({ done }).eq("id", id);
  if (error) throw new Error(error.message);
}
