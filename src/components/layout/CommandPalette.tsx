import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Package,
  PlusCircle,
  Settings,
  ShoppingCart,
  Store,
  Wallet,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

const PAGES = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Inventory", to: "/inventory", icon: Package },
  { label: "Add Inventory", to: "/inventory/new", icon: PlusCircle },
  { label: "Sales", to: "/sales", icon: ShoppingCart },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Reports", to: "/reports", icon: FileText },
  { label: "Expenses", to: "/expenses", icon: Wallet },
  { label: "Marketplace Connections", to: "/marketplace", icon: Store },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/inventory/new")}>
            <PlusCircle className="size-4" />
            Add inventory item
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/expenses")}>
            <Wallet className="size-4" />
            Log an expense
          </CommandItem>
          <CommandItem onSelect={() => go("/reports")}>
            <FileText className="size-4" />
            Generate monthly report
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              navigate("/marketplace");
            }}
          >
            <Store className="size-4" />
            Connect a marketplace
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          {PAGES.map((p) => (
            <CommandItem key={p.to} onSelect={() => go(p.to)}>
              <p.icon className="size-4" />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
