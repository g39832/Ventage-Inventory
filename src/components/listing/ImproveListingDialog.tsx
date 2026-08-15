import { useEffect, useState } from "react";
import { AlignLeft, Loader2, PenLine, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { askThreadly } from "@/lib/ai";
import { useData } from "@/lib/store";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ActionId = "title" | "write-description" | "improve-description" | "summarize";

const ACTIONS: {
  id: ActionId;
  label: string;
  icon: typeof Sparkles;
  target: "name" | "description";
  prompt: string;
}[] = [
  {
    id: "title",
    label: "Generate title",
    icon: Sparkles,
    target: "name",
    prompt:
      "Write a short, punchy listing title (under 10 words) for this vintage item. Include brand and era where they fit naturally. No hashtags.",
  },
  {
    id: "write-description",
    label: "Write description",
    icon: PenLine,
    target: "description",
    prompt:
      "Write a complete, professional vintage listing description (3–5 short paragraphs or scannable bullets): what it is, era and condition, standout features, sizing guidance, and a warm sign-off. Stay accurate to the facts in the context.",
  },
  {
    id: "improve-description",
    label: "Improve description",
    icon: Wand2,
    target: "description",
    prompt:
      "Improve this item's existing description to sound more professional and sellable while keeping every fact intact. If no existing description is present, write a fresh one.",
  },
  {
    id: "summarize",
    label: "Summarize item",
    icon: AlignLeft,
    target: "description",
    prompt:
      "Write a concise 2–3 sentence summary of this item, perfect for social posts or buyer messages.",
  },
];

export function ImproveListingDialog({
  item,
  open,
  onOpenChange,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateItem } = useData();
  const [target, setTarget] = useState<"name" | "description">("description");
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState<ActionId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to the item's current copy each time the dialog opens.
  useEffect(() => {
    if (open) {
      setTarget("description");
      setDraft(item.description);
      setError(null);
      setGenerating(null);
    }
  }, [open, item]);

  const generate = async (action: (typeof ACTIONS)[number]) => {
    setError(null);
    setGenerating(action.id);
    try {
      const result = await askThreadly({
        message: action.prompt,
        itemId: item.id,
      });
      setTarget(action.target);
      setDraft(result.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate content. Please try again.");
    } finally {
      setGenerating(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateItem(
        item.id,
        target === "name" ? { name: draft.trim() } : { description: draft.trim() }
      );
      toast("Listing updated", {
        description: target === "name" ? "Title saved." : "Description saved.",
      });
      onOpenChange(false);
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Improve listing</DialogTitle>
          <DialogDescription>
            Ask Threadly drafts copy from this item's details. Review and edit
            before saving — nothing changes until you hit Save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={generating !== null}
              onClick={() => void generate(a)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                generating === a.id
                  ? "border-primary bg-primary/5 text-foreground"
                  : "hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              {generating === a.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <a.icon className="size-4 text-primary" />
              )}
              {a.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Draft
            </p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {target === "name" ? "Will save to: Title" : "Will save to: Description"}
            </span>
          </div>
          <textarea
            rows={9}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Choose an action above to generate copy, or write your own…"
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-[13.5px] leading-relaxed shadow-xs outline-none focus-visible:ring-[3px]"
          />
        </div>

        {error && <p className="text-[12.5px] text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            disabled={!draft.trim() || saving || generating !== null}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save to item"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
