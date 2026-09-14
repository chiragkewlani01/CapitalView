"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseCsvForPreviewAction, confirmCsvImportAction } from "@/actions/csv-import";
import { generateCsvTemplate } from "@/lib/csv";
import { Upload, Loader2, CheckCircle2, XCircle, FileText, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Props {
  accounts: Array<{ id: string; name: string }>;
}

type Step = "upload" | "preview" | "done";

export function CsvImportDialog({ accounts }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [parseResult, setParseResult] = useState<{
    totalRows: number;
    validCount: number;
    errorCount: number;
    errors: Array<{ row: number; column: string; message: string }>;
    preview: Array<{ rowIndex: number; date: string; description: string; amount: string; type: string }>;
  } | null>(null);

  function downloadTemplate() {
    const csv = generateCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cashflowiq-import-template.csv";
    a.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const text = await file.text();
    const result = await parseCsvForPreviewAction(text);
    setLoading(false);

    if (!result.success || !result.data) {
      toast({ title: "Parse failed", description: result.error, variant: "destructive" });
      return;
    }

    setParseResult(result.data.parseResult);
    setBatchId(result.data.batchId);
    setStep("preview");
  }

  async function handleConfirm() {
    if (!accountId) {
      toast({ title: "Select account", description: "Please choose an account for import.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const result = await confirmCsvImportAction(batchId, accountId);
    setLoading(false);

    if (!result.success) {
      toast({ title: "Import failed", description: result.error, variant: "destructive" });
      return;
    }

    toast({
      title: `${result.importedCount} transactions imported`,
      description: "Your transactions have been imported successfully.",
    });
    setStep("done");
    router.refresh();
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => { setStep("upload"); setParseResult(null); }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import transactions.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Required columns: date, description, amount, type</p>
              <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs">
                <FileText className="h-3.5 w-3.5" />
                Download template
              </Button>
            </div>
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to upload CSV file</p>
                  <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
                </>
              )}
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
          </div>
        )}

        {step === "preview" && parseResult && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <strong>{parseResult.validCount}</strong> valid rows
              </span>
              {parseResult.errorCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <strong>{parseResult.errorCount}</strong> errors
                </span>
              )}
            </div>

            {parseResult.errors.length > 0 && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 max-h-32 overflow-y-auto">
                {parseResult.errors.slice(0, 8).map((err, i) => (
                  <p key={i} className="text-xs text-red-700">
                    Row {err.row}: {err.column} — {err.message}
                  </p>
                ))}
                {parseResult.errors.length > 8 && (
                  <p className="text-xs text-red-500 mt-1">...and {parseResult.errors.length - 8} more errors</p>
                )}
              </div>
            )}

            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.preview.slice(0, 6).map((row) => (
                    <tr key={row.rowIndex} className="border-t">
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate">{row.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.amount}</td>
                      <td className="px-3 py-2">
                        <Badge variant={row.type === "INFLOW" ? "success" : "outline"} className="text-[10px]">
                          {row.type}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {parseResult.validCount > 6 && (
                    <tr className="border-t">
                      <td colSpan={4} className="px-3 py-2 text-center text-muted-foreground">
                        +{parseResult.validCount - 6} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5">
              <Label>Import to account *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
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

            {parseResult.validCount === 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-md p-3">
                <AlertTriangle className="h-4 w-4" />
                No valid rows to import. Please fix the errors and re-upload.
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-lg">Import complete</p>
            <p className="text-sm text-muted-foreground">Transactions have been added to your account.</p>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && parseResult && parseResult.validCount > 0 && (
            <Button onClick={handleConfirm} disabled={loading || !accountId}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {parseResult.validCount} transactions
            </Button>
          )}
          {step === "preview" && (
            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {step === "done" ? "Close" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
