"use client";

import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useCallback } from "react";

interface TransactionFiltersBarProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  currentFilters: {
    search?: string;
    type?: string;
    categoryId?: string;
    accountId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export function TransactionFiltersBar({ accounts, categories, currentFilters }: TransactionFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams();
      const filters = { ...currentFilters, [key]: value, page: undefined };
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [currentFilters, pathname, router]
  );

  const hasFilters = Object.values(currentFilters).some(Boolean);

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input
        placeholder="Search transactions..."
        className="h-8 w-48 text-sm"
        defaultValue={currentFilters.search}
        onChange={(e) => {
          const val = e.target.value;
          const timer = setTimeout(() => updateFilter("search", val || undefined), 400);
          return () => clearTimeout(timer);
        }}
      />

      <Select
        value={currentFilters.type ?? "all"}
        onValueChange={(v) => updateFilter("type", v === "all" ? undefined : v)}
      >
        <SelectTrigger className="h-8 w-28 text-sm">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="INFLOW">Inflow</SelectItem>
          <SelectItem value="OUTFLOW">Outflow</SelectItem>
        </SelectContent>
      </Select>

      {categories.length > 0 && (
        <Select
          value={currentFilters.categoryId ?? "all"}
          onValueChange={(v) => updateFilter("categoryId", v === "all" ? undefined : v)}
        >
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {accounts.length > 0 && (
        <Select
          value={currentFilters.accountId ?? "all"}
          onValueChange={(v) => updateFilter("accountId", v === "all" ? undefined : v)}
        >
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Input
        type="date"
        className="h-8 w-32 text-sm"
        defaultValue={currentFilters.dateFrom}
        onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        className="h-8 w-32 text-sm"
        defaultValue={currentFilters.dateTo}
        onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push(pathname)}>
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
