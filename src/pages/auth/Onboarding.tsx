import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, PackageOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThreadlyMark } from "@/pages/auth/AuthLayout";
import { useAuth } from "@/lib/auth-provider";
import { emptyOnboarding, seedDemoData } from "@/lib/db/demo";

export default function Onboarding() {
  const { user, completeOnboarding } = useAuth();
  const [busy, setBusy] = useState<"demo" | "empty" | null>(null);
  const navigate = useNavigate();

  const choose = async (mode: "demo" | "empty") => {
    setBusy(mode);
    try {
      if (mode === "demo") {
        await seedDemoData();
      } else {
        await emptyOnboarding();
      }
      await completeOnboarding();
      toast(
        mode === "demo" ? "Demo shop is ready" : "All set — you're in",
        {
          description:
            mode === "demo"
              ? "We filled your shop with sample inventory, sales, and tasks."
              : "Your account is ready. Start by adding your first item.",
        }
      );
      navigate("/", { replace: true });
    } catch (err) {
      toast.error("Couldn't finish setting up your shop", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-2xl animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <ThreadlyMark className="size-12" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Threadly{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Your account is ready. Start with a pre-filled demo shop so you can see how Threadly
            works, or begin with a clean slate.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="relative overflow-hidden border-primary/30">
            <CardContent className="flex h-full flex-col gap-4 p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">Start with demo data</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Sample vintage inventory, recent sales, expenses, tasks, and marketplace
                  connections — all owned by your account and ready to explore.
                </p>
              </div>
              <div className="mt-auto pt-1">
                <Button className="w-full" onClick={() => choose("demo")} disabled={busy !== null}>
                  {busy === "demo" ? "Setting up…" : "Explore with demo data"}
                  {busy !== "demo" && <ArrowRight className="size-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full flex-col gap-4 p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <PackageOpen className="size-5" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">Start with empty inventory</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Begin with zero items. Add your first piece whenever you're ready — nothing is
                  pre-populated.
                </p>
              </div>
              <div className="mt-auto pt-1">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => choose("empty")}
                  disabled={busy !== null}
                >
                  {busy === "empty" ? "Setting up…" : "Start empty"}
                  {busy !== "empty" && <ArrowRight className="size-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mt-6 text-center text-[12.5px] text-muted-foreground">
          You can add or remove data anytime — this choice just sets your starting point.
        </p>
      </div>
    </div>
  );
}
