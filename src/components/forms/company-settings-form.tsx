"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanySettingsAction } from "@/actions/company";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  company: {
    name: string;
    currency: string;
    minCashThreshold: string;
    industry: string;
  };
}

export function CompanySettingsForm({ company }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const result = await updateCompanySettingsAction({
      name: fd.get("name") as string,
      industry: (fd.get("industry") as string) || undefined,
      minCashThreshold: (fd.get("minCashThreshold") as string) || "0",
    });

    setLoading(false);
    if (!result.success) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Settings saved" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Company Name</Label>
          <Input id="name" name="name" defaultValue={company.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="industry">Industry</Label>
          <Input id="industry" name="industry" defaultValue={company.industry} placeholder="Manufacturing" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minCashThreshold">Min Cash Threshold</Label>
          <Input
            id="minCashThreshold"
            name="minCashThreshold"
            type="number"
            min="0"
            step="0.01"
            defaultValue={company.minCashThreshold}
          />
          <p className="text-xs text-muted-foreground">Alert when cash falls below this amount</p>
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Input value={company.currency} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">Currency cannot be changed after setup</p>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </Button>
    </form>
  );
}
