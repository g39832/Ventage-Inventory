import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { GoogleIcon } from "@/pages/auth/Login";
import { useAuth } from "@/lib/auth-provider";

export default function Signup() {
  const { signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Fill in your name, email, and password.");
      return;
    }
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
      const { needsEmailConfirmation } = await signUp(email, password, name);
      if (needsEmailConfirmation) {
        setConfirmed(true);
      } else {
        toast("Welcome to Regroove!", {
          description: "Your shop is ready — let's get you set up.",
        });
        // The router lands on /onboarding once the session is active.
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create your account.");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to sign up with Google.");
      setGoogleBusy(false);
    }
  };

  if (confirmed) {
    return (
      <AuthLayout title="Check your email" subtitle="One more step to finish creating your account.">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
            Click it to activate your account — then you'll be able to sign in.
          </p>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/login">Back to sign in</Link>
          </Button>
          <p className="text-center text-[12.5px] text-muted-foreground">
            Didn't get it?{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setConfirmed(false);
                toast("Check your spam folder too.", {
                  description: "Confirmation emails sometimes land there.",
                });
              }}
            >
              Try again
            </button>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your shop in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGoogle}
          disabled={busy || googleBusy}
        >
          <GoogleIcon />
          {googleBusy ? "Redirecting to Google…" : "Sign up with Google"}
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            or
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Grayson R."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
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
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || googleBusy}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link to="/terms" className="font-medium text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="font-medium text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
