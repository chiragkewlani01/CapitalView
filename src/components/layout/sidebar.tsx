"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  CreditCard,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Lightbulb,
  FileBarChart,
  Settings,
  ChevronDown,
  Waves,
  Target,
  GitBranch,
  PieChart,
} from "lucide-react";
import React, { useState } from "react";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  {
    label: "Financials",
    icon: ArrowLeftRight,
    children: [
      { label: "Transactions", href: "/financials/transactions", icon: ArrowLeftRight },
      { label: "Receivables", href: "/financials/receivables", icon: FileText },
      { label: "Payables", href: "/financials/payables", icon: CreditCard },
    ],
  },
  {
    label: "Planning",
    icon: TrendingUp,
    children: [
      { label: "Cash Flow", href: "/planning/cashflow", icon: Waves },
      { label: "Forecast", href: "/planning/forecast", icon: TrendingUp },
      { label: "Scenarios", href: "/planning/scenarios", icon: GitBranch },
      { label: "Budgets", href: "/planning/budgets", icon: Target },
    ],
  },
  {
    label: "Intelligence",
    icon: Lightbulb,
    children: [
      { label: "Risks", href: "/intelligence/risks", icon: AlertTriangle },
      { label: "Insights", href: "/intelligence/insights", icon: Lightbulb },
    ],
  },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Settings", href: "/settings", icon: Settings },
];

function NavGroup({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname();
  const isActive = item.href ? pathname.startsWith(item.href) : false;
  const hasActiveChild = item.children?.some((c) => c.href && pathname.startsWith(c.href));
  const [open, setOpen] = useState(hasActiveChild || false);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            hasActiveChild
              ? "text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="ml-4 mt-0.5 border-l border-border pl-3 space-y-0.5">
            {item.children.map((child) => (
              <NavGroup key={child.label} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r bg-background h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <PieChart className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm tracking-tight">CashFlowIQ</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navigation.map((item) => (
          <NavGroup key={item.label} item={item} />
        ))}
      </nav>
    </aside>
  );
}
