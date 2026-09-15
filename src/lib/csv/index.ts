import Papa from "papaparse";
import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { toMinorUnits } from "@/lib/calculations";

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: bigint;
  type: TransactionType;
  reference?: string;
  notes?: string;
  categoryName?: string;
  rowIndex: number;
}

export interface CsvValidationError {
  row: number;
  column: string;
  value: string;
  message: string;
}

export interface CsvParseResult {
  valid: ParsedTransaction[];
  errors: CsvValidationError[];
  totalRows: number;
}

const CSV_DATE_FORMATS = [
  /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
  /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
  /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
];

function parseDate(str: string): Date | null {
  const trimmed = str.trim();

  // ISO format
  if (CSV_DATE_FORMATS[0].test(trimmed)) {
    const d = new Date(trimmed + "T00:00:00.000Z");
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY
  const dmySlash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmySlash) {
    const d = new Date(`${dmySlash[3]}-${dmySlash[2]}-${dmySlash[1]}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD-MM-YYYY
  const dmyDash = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyDash) {
    const d = new Date(`${dmyDash[3]}-${dmyDash[2]}-${dmyDash[1]}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Try native
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

function parseAmount(str: string): bigint | null {
  const trimmed = str.trim().replace(/[,\s₹$€£]/g, "");
  const num = parseFloat(trimmed);
  if (isNaN(num) || !isFinite(num)) return null;
  if (num < 0) return null; // negatives handled via type column
  return toMinorUnits(Math.abs(num));
}

function parseType(str: string): TransactionType | null {
  const normalized = str.trim().toUpperCase();
  if (["INFLOW", "INCOME", "CREDIT", "IN", "+"].includes(normalized)) {
    return TransactionType.INFLOW;
  }
  if (["OUTFLOW", "EXPENSE", "DEBIT", "OUT", "-"].includes(normalized)) {
    return TransactionType.OUTFLOW;
  }
  return null;
}

/**
 * Required columns (case-insensitive): date, description, amount, type
 * Optional: reference, notes, category
 */
const REQUIRED_COLUMNS = ["date", "description", "amount", "type"];
const OPTIONAL_COLUMNS = ["reference", "notes", "category"];

export function parseCsv(csvText: string): CsvParseResult {
  let parseData: Papa.ParseResult<Record<string, string>> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Papa as any).parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase(),
    complete: (results: Papa.ParseResult<Record<string, string>>) => {
      parseData = results;
    },
  });

  const result = parseData as Papa.ParseResult<Record<string, string>> | null;
  if (!result) {
    return { valid: [], errors: [{ row: 0, column: "file", value: "", message: "Failed to parse CSV." }], totalRows: 0 };
  }

  if (!result.data.length) {
    return { valid: [], errors: [{ row: 0, column: "file", value: "", message: "CSV file is empty or has no data rows." }], totalRows: 0 };
  }

  // Normalize headers to lowercase
  const headers = result.meta.fields?.map((h) => h.toLowerCase().trim()) ?? [];

  // Check required columns
  const missingCols = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missingCols.length > 0) {
    return {
      valid: [],
      errors: [{
        row: 0,
        column: "headers",
        value: headers.join(", "),
        message: `Missing required columns: ${missingCols.join(", ")}. Found: ${headers.join(", ")}`,
      }],
      totalRows: 0,
    };
  }

  const valid: ParsedTransaction[] = [];
  const errors: CsvValidationError[] = [];

  result.data.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed, +1 for header
    const normalizedRow: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      normalizedRow[key.toLowerCase().trim()] = String(val ?? "");
    }

    let hasError = false;

    // Date
    const dateRaw = normalizedRow["date"] ?? "";
    const date = parseDate(dateRaw);
    if (!date) {
      errors.push({ row: rowNum, column: "date", value: dateRaw, message: "Invalid date. Expected formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY." });
      hasError = true;
    }

    // Description
    const description = normalizedRow["description"]?.trim() ?? "";
    if (!description) {
      errors.push({ row: rowNum, column: "description", value: "", message: "Description is required." });
      hasError = true;
    }

    // Amount
    const amountRaw = normalizedRow["amount"] ?? "";
    const amount = parseAmount(amountRaw);
    if (amount === null) {
      errors.push({ row: rowNum, column: "amount", value: amountRaw, message: "Invalid amount. Must be a positive number." });
      hasError = true;
    }

    // Type
    const typeRaw = normalizedRow["type"] ?? "";
    const type = parseType(typeRaw);
    if (!type) {
      errors.push({ row: rowNum, column: "type", value: typeRaw, message: "Invalid type. Must be: INFLOW/INCOME/CREDIT or OUTFLOW/EXPENSE/DEBIT." });
      hasError = true;
    }

    if (!hasError && date && amount !== null && type) {
      valid.push({
        date,
        description,
        amount,
        type,
        reference: normalizedRow["reference"]?.trim() || undefined,
        notes: normalizedRow["notes"]?.trim() || undefined,
        categoryName: normalizedRow["category"]?.trim() || undefined,
        rowIndex: rowNum,
      });
    }
  });

  return {
    valid,
    errors,
    totalRows: result.data.length,
  };
}

export function generateCsvTemplate(): string {
  const headers = ["date", "description", "amount", "type", "reference", "notes", "category"];
  const examples = [
    ["2024-01-15", "Customer Payment - ABC Corp", "50000", "INFLOW", "INV-001", "", "Sales"],
    ["2024-01-20", "Office Rent - January", "25000", "OUTFLOW", "RENT-JAN", "", "Rent"],
    ["2024-01-22", "Raw Material Purchase", "75000", "OUTFLOW", "PO-2024-01", "Supplier XYZ", "Cost of Goods"],
  ];
  return [headers.join(","), ...examples.map((r) => r.join(","))].join("\n");
}
