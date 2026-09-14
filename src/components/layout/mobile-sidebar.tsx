"use client";

import { useState } from "react";
import { Menu, PieChart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const mobileNav = [
  { label: "Overview", href: "/overview" },
  { label: "Transactions", href: "/financials/transactions" },
  { label: "Receivables", href: "/financials/receivables" },
  { label: "Payables", href: "/financials/payables" },
  { label: "Cash Flow", href: "/planning/cashflow" },
  { label: "Forecast", href: "/planning/forecast" },
  { label: "Scenarios", href: "/planning/scenarios" },
  { label: "Budgets", href: "/planning/budgets" },
  { label: "Risks", href: "/intelligence/risks" },
  { label: "Insights", href: "/intelligence/insights" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
];

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                  <PieChart className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-sm">CashFlowIQ</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
              {mobileNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname.startsWith(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
