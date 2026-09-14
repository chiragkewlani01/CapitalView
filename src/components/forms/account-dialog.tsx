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
import { createAccountAction } from "@/actions/accounts";
import { AccountType } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props { children: React.ReactNode }

export function AccountDialog({ children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<AccountType>(AccountType.BANK);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const result = await createAccountAction({
      name: fd.get("name") as string,
      type,
      bankName: (fd.get("bankName") as string) || undefined,
      accountNumber: (fd.get("accountNumber") as string) || undefined,
      balance: (fd.get("balance") as string) || "0",
      description: (fd.get("description") as string) || undefined,
    });

    setLoading(false);
    if (!result.success) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Account created" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Add Financial Account</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Account Name *</Label>
            <Input id="name" name="name" placeholder="Main Current Account" required />
          </div>
          <div className="space-y-1.5">
            <Label>Account Type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK">Bank Account</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CREDIT">Credit Card</SelectItem>
                <SelectItem value="INVESTMENT">Investment</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input id="bankName" name="bankName" placeholder="HDFC Bank" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountNumber">Last 4 Digits</Label>
              <Input id="accountNumber" name="accountNumber" maxLength={4} placeholder="1234" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="balance">Opening Balance</Label>
            <Input id="balance" name="balance" type="number" min="0" step="0.01" placeholder="0.00" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
