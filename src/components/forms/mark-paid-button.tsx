"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markReceivablePaidAction } from "@/actions/receivables";
import { markPayablePaidAction } from "@/actions/payables";
import { Loader2, CheckCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  id: string;
  entity: "receivable" | "payable";
}

export function MarkPaidButton({ id, entity }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result =
      entity === "receivable"
        ? await markReceivablePaidAction(id)
        : await markPayablePaidAction(id);
    setLoading(false);

    if (!result.success) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as paid" });
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
      Mark Paid
    </Button>
  );
}
