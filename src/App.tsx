import type { ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthProvider, useAuth } from "@/lib/auth-provider";
import { DataProvider, useData } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/db/client";
import { ThreadlyMark } from "@/pages/auth/AuthLayout";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import Onboarding from "@/pages/auth/Onboarding";
import Dashboard from "@/pages/Dashboard";
import AskThreadly from "@/pages/AskThreadly";
import Inventory from "@/pages/Inventory";
import InventoryDetails from "@/pages/InventoryDetails";
import AddInventory from "@/pages/AddInventory";
import Sales from "@/pages/Sales";
import Expenses from "@/pages/Expenses";
import Analytics from "@/pages/Analytics";
import Marketplace from "@/pages/Marketplace";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import EbayCallback from "@/pages/EbayCallback";
import { Privacy, Terms } from "@/pages/Legal";

function SetupRequired() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Connect Threadly to Supabase</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Threadly is built on Supabase and needs your project's public URL and anon key
              before it can load your data.
            </p>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Create a project at supabase.com (or reuse an existing one).</li>
            <li>
              Open <span className="font-mono text-[12.5px]">supabase/schema.sql</span> in the
              SQL editor and run it, then run{" "}
              <span className="font-mono text-[12.5px]">supabase/seed.sql</span> to load demo data.
            </li>
            <li>
              Copy <span className="font-mono text-[12.5px]">.env.example</span> to{" "}
              <span className="font-mono text-[12.5px]">.env.local</span> and paste in your
              project URL and anon key (Project Settings → API).
            </li>
            <li>
              Restart the dev server, then reload this page. To enable Google sign-in, follow the
              steps in <span className="font-mono text-[12.5px]">supabase/AUTH_SETUP.md</span>.
            </li>
          </ol>
          <p className="rounded-md bg-muted/60 px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
            Keys stay in <span className="font-mono">.env.local</span> (git-ignored). Never use the
            service_role key in the frontend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AppLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <ThreadlyMark className="animate-pulse" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function DataError({ onRetry }: { onRetry: () => void }) {
  const { error } = useData();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">We couldn't load your data</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{error}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onRetry}>Try again</Button>
            <Button variant="outline" asChild>
              <Link to="/">Go to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Renders the app only once the shop data has loaded (or errored). */
function DataGate({ children }: { children: ReactNode }) {
  const { status, retry } = useData();
  if (status === "loading") return <AppLoading label="Loading your shop…" />;
  if (status === "error") return <DataError onRetry={retry} />;
  return children;
}

/** Signed-in users heading to auth pages bounce back into the app. */
function SignedInRedirect() {
  return <Navigate to="/" replace />;
}

/** Blocks the shell until the user has completed onboarding. */
function RequireOnboarded() {
  const { user } = useAuth();
  if (!user?.onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function PublicRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function ProtectedRoutes() {
  const { user } = useAuth();

  return (
    <DataProvider key={user!.id}>
      <DataGate>
        <Routes>
          <Route path="/login" element={<SignedInRedirect />} />
          <Route path="/signup" element={<SignedInRedirect />} />
          <Route path="/forgot-password" element={<SignedInRedirect />} />
          <Route path="/reset-password" element={<SignedInRedirect />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/ebay/callback" element={<EbayCallback />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route element={<RequireOnboarded />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ask" element={<AskThreadly />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/inventory/new" element={<AddInventory />} />
              <Route path="/inventory/:id" element={<InventoryDetails />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </DataGate>
    </DataProvider>
  );
}

function AppRoutes() {
  const { status } = useAuth();

  if (!isSupabaseConfigured) return <SetupRequired />;
  if (status === "loading") return <AppLoading label="Loading your account…" />;
  if (status === "signed-out") return <PublicRoutes />;
  return <ProtectedRoutes />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
