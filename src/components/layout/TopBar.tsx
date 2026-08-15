import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  CircleCheck,
  LogOut,
  Menu,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-provider";
import { initials } from "@/lib/format";
import { SidebarContent } from "@/components/layout/Sidebar";

const TITLES: [string, string][] = [
  ["/ask", "Ask Regroove"],
  ["/inventory/new", "Add Inventory"],
  ["/inventory", "Inventory"],
  ["/sales", "Sales"],
  ["/analytics", "Analytics"],
  ["/reports", "Reports"],
  ["/expenses", "Expenses"],
  ["/marketplace", "Marketplace Connections"],
  ["/settings", "Settings"],
];

const NOTIFICATIONS = [
  {
    icon: ShoppingCart,
    title: "New sale on eBay",
    body: "Carhartt Detroit Work Jacket sold for $160.00",
    time: "12m",
  },
  {
    icon: Package,
    title: "3 listings end soon",
    body: "Repost before the weekend rush to stay visible.",
    time: "1h",
  },
  {
    icon: CircleCheck,
    title: "Weekly report ready",
    body: "August 1 – 6 summary is generated.",
    time: "3h",
  },
];

export function TopBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);

  const match = TITLES.find(([path]) => location.pathname.startsWith(path));
  const title = location.pathname === "/" ? "Dashboard" : (match?.[1] ?? "Regroove");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <p className="text-[15px] font-semibold tracking-tight">{title}</p>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 w-56 justify-between gap-2 text-muted-foreground sm:flex"
          onClick={onOpenCommand}
        >
          <span className="inline-flex items-center gap-2">
            <Search className="size-3.5" />
            Search…
          </span>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </Button>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={onOpenCommand}>
          <Search className="size-4.5" />
        </Button>

        <Button
          size="sm"
          className="ml-1 hidden sm:inline-flex"
          onClick={() => navigate("/inventory/new")}
        >
          <Plus className="size-4" />
          New item
        </Button>

        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-[18px]" />
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-clay" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-1">
            <DropdownMenuLabel className="px-2 pt-1.5 pb-2 text-sm">
              Notifications
            </DropdownMenuLabel>
            <div className="space-y-0.5">
              {NOTIFICATIONS.map((n, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/60"
                  onClick={() => {
                    setNotifOpen(false);
                    toast(n.title, { description: n.body });
                  }}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground">
                    <n.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{n.title}</span>
                      <span className="text-[11px] text-muted-foreground">{n.time}</span>
                    </span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {n.body}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center"
              onClick={() => {
                setNotifOpen(false);
                toast("All caught up", { description: "You're up to date on notifications." });
              }}
            >
              Mark all as read
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-1.5 px-1.5">
              <Avatar className="size-7">
                {user?.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                ) : null}
                <AvatarFallback className="bg-clay/15 text-[11px] font-semibold text-clay">
                  {initials(user?.displayName || "V")}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="px-2">
              <p className="text-sm font-semibold">{user?.displayName || "Regroove user"}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {user?.email || "No email set yet"}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void signOut().then(() => {
                  toast("Signed out", { description: "See you next time." });
                });
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
