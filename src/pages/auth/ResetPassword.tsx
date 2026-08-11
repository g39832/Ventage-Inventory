import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { exchangeRecoveryCode, hasActiveSession, signOut, updatePassword } from "@/lib/auth";

type LinkState = "checking" | "ready" | "invalid";

export default function ResetPassword() {
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const code = searchParams.get("code");
      try {
        if (code) {
          await exchangeRecoveryCode(code);
        } else if (!(await hasActiveSession())) {
          throw new Error("no-session");
        }
        if (!cancelled) setLinkState("ready");
      } catch {
        if (!cancelled) setLinkState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Your password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      await signOut();
      toast("Password updated", {
        description: "Sign in with your new password.",
      });
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your password.");
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
    >
      {linkState === "checking" && (
        <div className="space-y-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Checking your reset link…</p>
        </div>
      )}

      {linkState === "invalid" && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            This password reset link is invalid or has expired. Request a new one and try again.
          </p>
          <Button className="w-full" asChild>
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      )}

      {linkState === "ready" && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
