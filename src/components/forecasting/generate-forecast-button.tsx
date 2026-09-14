"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateForecastAction } from "@/actions/forecasts";
import { ForecastScenario } from "@prisma/client";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function GenerateForecastButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    const result = await generateForecastAction(ForecastScenario.BASE, 90);
    setLoading(false);

    if (!result.success) {
      toast({ title: "Forecast failed", variant: "destructive" });
      return;
    }

    toast({ title: "Forecast generated" });
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Refresh Forecast
    </Button>
  );
}
