"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBudgetAction } from "@/actions/budgets";
import { BudgetPeriod } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  children: React.ReactNode;
  categories: Array<{ id: string; name: string }>;
  year: number;
  month: number;
}

export function BudgetDialog({ children, categories, year, month }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!categoryId) {
      toast({ title: "Select a category", variant: "destructive" });
      return;
    }
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const result = await createBudgetAction({
      categoryId,
      budgetedAmount: fd.get("amount") as string,
      period: BudgetPeriod.MONTHLY,
      periodYear: year,
      periodMonth: month,
    });

    setLoading(false);
    if (!result.success) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Budget created" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>New Monthly Budget</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Budget Amount *</Label>
            <Input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
