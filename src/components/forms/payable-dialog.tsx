"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPayableAction } from "@/actions/payables";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props { children: React.ReactNode }

export function PayableDialog({ children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const result = await createPayableAction({
      vendorName: fd.get("vendorName") as string,
      vendorEmail: (fd.get("vendorEmail") as string) || undefined,
      billNumber: (fd.get("billNumber") as string) || undefined,
      description: fd.get("description") as string,
      amount: fd.get("amount") as string,
      issueDate: fd.get("issueDate") as string,
      dueDate: fd.get("dueDate") as string,
      notes: (fd.get("notes") as string) || undefined,
    });

    setLoading(false);
    if (!result.success) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Bill created" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Bill (Payable)</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vendorName">Vendor *</Label>
              <Input id="vendorName" name="vendorName" placeholder="Vendor name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendorEmail">Email</Label>
              <Input id="vendorEmail" name="vendorEmail" type="email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="billNumber">Bill #</Label>
              <Input id="billNumber" name="billNumber" placeholder="BILL-001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount *</Label>
              <Input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description *</Label>
            <Input id="description" name="description" placeholder="Bill description" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="issueDate">Issue Date *</Label>
              <Input id="issueDate" name="issueDate" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input id="dueDate" name="dueDate" type="date" defaultValue={thirtyDays} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Bill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
