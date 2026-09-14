"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCompanyAction } from "@/actions/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Loader2, Building2 } from "lucide-react";

const INDUSTRIES = [
  "Manufacturing", "Retail", "Technology", "Healthcare", "Construction",
  "Real Estate", "Hospitality", "Education", "Professional Services",
  "Financial Services", "Logistics", "Agriculture", "Other",
];

const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "SGD", label: "Singapore Dollar (S$)" },
  { code: "AED", label: "UAE Dirham (AED)" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [industry, setIndustry] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = await createCompanyAction({
      name: fd.get("name") as string,
      industry,
      currency,
      minCashThreshold: fd.get("minCashThreshold") as string,
    });

    if (!result.success) {
      setError(result.error ?? "Failed to create company.");
      setLoading(false);
      return;
    }

    router.push("/overview");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-muted/30">
      <div className="w-full max-w-md bg-background rounded-xl border shadow-sm p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <PieChart className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">CashFlowIQ</h1>
            <p className="text-xs text-muted-foreground">Financial Intelligence Platform</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Set up your company</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Tell us about your business to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Company name *</Label>
            <Input id="name" name="name" placeholder="Meridian Manufacturing Pvt Ltd" required minLength={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="minCashThreshold">Minimum cash threshold</Label>
            <Input
              id="minCashThreshold"
              name="minCashThreshold"
              type="number"
              min="0"
              placeholder="500000"
              className="tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Alert when cash balance falls below this amount. Leave blank to skip.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create company & get started
          </Button>
        </form>
      </div>
    </div>
  );
}
