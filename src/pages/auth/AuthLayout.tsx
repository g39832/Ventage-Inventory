import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export function VentageMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-clay text-[#fbf3e4] shadow-sm ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
      </svg>
    </span>
  );
}

const HIGHLIGHTS = [
  "Track every piece from sourcing to sold",
  "Per-marketplace listing status",
  "Real profit math on every sale",
  "Your data is isolated to your account",
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-background">
      {/* Brand panel */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#211a12] p-10 text-[#f3ead9] lg:flex">
        <div className="pointer-events-none absolute -top-28 -left-24 size-96 rounded-full bg-clay/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full bg-[#8a6d3b]/25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <VentageMark />
          <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        <div className="relative max-w-md space-y-5">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Inventory for vintage resellers.
          </h2>
          <p className="text-[15px] leading-relaxed text-[#d8cbb2]">
            One shop, one source of truth — across eBay, Depop, Poshmark, Vinted, and more.
          </p>
          <ul className="space-y-2.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-2.5 text-[13.5px] text-[#d8cbb2]">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#8a6d3b]/40 text-[#f3ead9]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[12.5px] text-[#a8977c]">
          © {new Date().getFullYear()} {APP_NAME}
          {SUPPORT_EMAIL && (
            <>
              {" · "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline-offset-2 hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </>
          )}
        </p>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <VentageMark />
            <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
          </div>
          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-6">
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {subtitle && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
              )}
              <div className="mt-6">{children}</div>
            </CardContent>
          </Card>
          {footer && (
            <div className="mt-5 text-center text-[13px] text-muted-foreground">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
