import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, Eraser, Shirt, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { askVentage, SUGGESTED_QUESTIONS, type AiTurn } from "@/lib/ai";
import { cn } from "@/lib/utils";

interface ChatMessage extends AiTurn {
  relatedItemIds?: string[];
}

export default function AskVentage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    const history = messages
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const result = await askVentage({ message: question, history });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          relatedItemIds: result.relatedItemIds,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Ask Ventage"
        description="Ask questions about your inventory, sales, and business."
        crumbs={[{ label: "Ask Ventage" }]}
        actions={
          messages.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
            >
              <Eraser className="size-3.5" />
              New conversation
            </Button>
          ) : undefined
        }
      />

      <Card className="flex min-h-[560px] flex-col overflow-hidden p-0!">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-6 md:px-8">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-7" />
              </span>
              <div className="max-w-md">
                <p className="text-[15px] font-semibold">Ask about your shop</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Ventage looks up the answers in your own inventory, sales, and
                  expenses — then explains them. Try one of these:
                </p>
              </div>
              <div className="grid w-full max-w-lg gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="rounded-lg border bg-muted/30 px-3.5 py-2.5 text-left text-[13px] font-medium text-foreground/90 transition-colors hover:border-primary/40 hover:bg-muted/60"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] space-y-2 rounded-xl px-4 py-3 text-[13.5px] leading-relaxed md:max-w-[75%]",
                      m.role === "user"
                        ? "rounded-br-sm bg-primary/10 text-foreground ring-1 ring-primary/20"
                        : "rounded-bl-sm bg-muted/50 ring-1 ring-border"
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                          <Shirt className="size-3.5" />
                        </span>
                        <p className="min-w-0 whitespace-pre-wrap">{m.content}</p>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                    {m.role === "assistant" && (m.relatedItemIds?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-8">
                        {m.relatedItemIds!.map((id) => (
                          <Link
                            key={id}
                            to={`/inventory/${id}`}
                            className="inline-flex items-center gap-1 rounded-full border bg-background/70 px-2.5 py-1 text-[11.5px] font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                          >
                            <Shirt className="size-3" />
                            View item
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2.5 rounded-xl rounded-bl-sm bg-muted/50 px-4 py-3 ring-1 ring-border">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Shirt className="size-3.5" />
                    </span>
                    <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                      <span className="size-1.5 animate-bounce rounded-full bg-current" />
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="border-t border-destructive/30 bg-destructive/10 px-5 py-2.5 text-[12.5px] text-destructive">
            {error}
          </div>
        )}

        {/* Composer */}
        <div className="border-t bg-card/60 p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              rows={1}
              value={input}
              disabled={loading}
              placeholder="Ask about your shop… (Enter to send, Shift+Enter for a new line)"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border bg-muted/30 px-3.5 py-2.5 text-[13.5px] outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            <Button
              size="icon"
              className="size-10 shrink-0"
              disabled={!input.trim() || loading}
              onClick={() => void send()}
              aria-label="Send question"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-[11.5px] text-muted-foreground/70">
            Ventage answers from your own data only. AI usage is charged to your OpenAI account —
            limited to 30 questions per hour.
          </p>
        </div>
      </Card>
    </div>
  );
}
