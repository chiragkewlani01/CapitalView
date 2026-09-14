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
import { Textarea } from "@/components/ui/textarea";
import { createTransactionAction } from "@/actions/transactions";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}

export function TransactionDialog({ accounts, categories, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<TransactionType>(TransactionType.OUTFLOW);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = await createTransactionAction({
      accountId,
      categoryId: categoryId || undefined,
      type,
      amount: fd.get("amount") as string,
      description: fd.get("description") as string,
      reference: (fd.get("reference") as string) || undefined,
      date: fd.get("date") as string,
      notes: (fd.get("notes") as string) || undefined,
    });

    setLoading(false);

    if (!result.success) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    toast({ title: "Transaction added", variant: "success" as never });
    setOpen(false);
    router.refresh();
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFLOW">Inflow (Income)</SelectItem>
                  <SelectItem value="OUTFLOW">Outflow (Expense)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount *</Label>
              <Input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description *</Label>
            <Input id="description" name="description" placeholder="Transaction description" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date *</Label>
              <Input id="date" name="date" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" name="reference" placeholder="INV-001" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Account *</Label>
            <Select value={accountId} onValueChange={setAccountId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Optional notes..." rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
