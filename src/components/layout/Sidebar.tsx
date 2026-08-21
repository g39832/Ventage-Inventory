import { NavLink, Link } from "react-router-dom";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Package,
  PlusCircle,
  Search,
  Settings,
  Shirt,
  ShoppingCart,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard },
      { label: "Ask Regroove", to: "/ask", icon: Sparkles },
    ],
  },
  {
    group: "Inventory",
    items: [
      { label: "Inventory", to: "/inventory", icon: Package },
      { label: "Add Inventory", to: "/inventory/new", icon: PlusCircle },
    ],
  },
  {
    group: "Selling",
    items: [
      { label: "Research", to: "/research", icon: Search },
      { label: "Sales", to: "/sales", icon: ShoppingCart },
      { label: "Analytics", to: "/analytics", icon: BarChart3 },
      { label: "Reports", to: "/reports", icon: FileText },
    ],
  },
  {
    group: "Manage",
    items: [
      { label: "Expenses", to: "/expenses", icon: Wallet },
      { label: "Marketplaces", to: "/marketplace", icon: Store },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-5 pt-5 pb-4"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Shirt className="size-4" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight">Regroove</span>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pt-2">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              {section.group}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13.5px] font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )
                    }
                  >
                    <item.icon className="size-[17px] shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-clay/15 text-xs font-semibold text-clay">
              GR
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">Grayson's Vintage</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Pro reseller
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-[228px] shrink-0 border-r bg-card/70 backdrop-blur lg:block">
      <SidebarContent />
    </aside>
  );
}
