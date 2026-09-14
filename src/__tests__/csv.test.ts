import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv";

const VALID_CSV = `date,description,amount,type
2024-01-15,Customer Payment,50000,INFLOW
2024-01-20,Office Rent,25000,OUTFLOW
2024-01-22,Raw Materials,75000,OUTFLOW
`;

describe("parseCsv", () => {
  it("parses valid CSV correctly", () => {
    const result = parseCsv(VALID_CSV);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(3);
    expect(result.totalRows).toBe(3);
  });

  it("parses amounts as minor units", () => {
    const result = parseCsv(VALID_CSV);
    expect(result.valid[0].amount).toBe(5_000_000n); // 50000 * 100
  });

  it("parses dates correctly", () => {
    const result = parseCsv(VALID_CSV);
    expect(result.valid[0].date.getFullYear()).toBe(2024);
    expect(result.valid[0].date.getMonth()).toBe(0); // January
  });

  it("normalizes type values", () => {
    const result = parseCsv(VALID_CSV);
    expect(result.valid[0].type).toBe("INFLOW");
    expect(result.valid[1].type).toBe("OUTFLOW");
  });

  it("accepts alternative type names", () => {
    const csv = `date,description,amount,type
2024-01-15,Payment,1000,CREDIT
2024-01-16,Expense,500,DEBIT
2024-01-17,Income,2000,IN
2024-01-18,Cost,300,OUT
`;
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0].type).toBe("INFLOW");
    expect(result.valid[1].type).toBe("OUTFLOW");
  });

  it("accepts DD/MM/YYYY date format", () => {
    const csv = `date,description,amount,type
15/01/2024,Test,1000,INFLOW
`;
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0].date.getFullYear()).toBe(2024);
  });

  it("reports error for missing required columns", () => {
    const csv = `date,description,amount
2024-01-15,Test,1000
`;
    const result = parseCsv(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].column).toBe("headers");
  });

  it("reports error for invalid date", () => {
    const csv = `date,description,amount,type
not-a-date,Test,1000,INFLOW
`;
    const result = parseCsv(csv);
    const dateError = result.errors.find((e) => e.column === "date");
    expect(dateError).toBeDefined();
  });

  it("reports error for invalid amount", () => {
    const csv = `date,description,amount,type
2024-01-15,Test,not-a-number,INFLOW
`;
    const result = parseCsv(csv);
    const amtError = result.errors.find((e) => e.column === "amount");
    expect(amtError).toBeDefined();
  });

  it("reports error for invalid type", () => {
    const csv = `date,description,amount,type
2024-01-15,Test,1000,INVALID_TYPE
`;
    const result = parseCsv(csv);
    const typeError = result.errors.find((e) => e.column === "type");
    expect(typeError).toBeDefined();
  });

  it("handles partial errors — valid rows extracted", () => {
    const csv = `date,description,amount,type
2024-01-15,Valid row,1000,INFLOW
not-a-date,Bad date row,1000,INFLOW
2024-01-17,Another valid,500,OUTFLOW
`;
    const result = parseCsv(csv);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
  });

  it("handles empty CSV", () => {
    const result = parseCsv("");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.valid).toHaveLength(0);
  });

  it("handles CSV with category column", () => {
    const csv = `date,description,amount,type,category
2024-01-15,Sales,1000,INFLOW,Product Sales
`;
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0].categoryName).toBe("Product Sales");
  });

  it("strips currency symbols from amounts", () => {
    const csv = `date,description,amount,type
2024-01-15,Test,₹1000,INFLOW
`;
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0].amount).toBe(100_000n);
  });
});
