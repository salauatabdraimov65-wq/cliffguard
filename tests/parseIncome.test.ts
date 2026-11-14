import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseIncomeCsv, parseAmount, parseDate, confidenceFor, ParseIncomeError } from "../lib/parseIncome";

const demoCsv = readFileSync("public/demo-bank.csv", "utf8");

describe("parseIncomeCsv", () => {
  it("demo bank CSV: $84k client income over 8 months, transfers filtered", () => {
    const r = parseIncomeCsv(demoCsv);
    const total = r.transactions.reduce((s, t) => s + t.amount, 0);
    expect(r.months).toBe(8);
    expect(r.transactions).toHaveLength(22);
    expect(total).toBe(84000);
    expect(r.projectedAnnualIncome).toBe(126000); // 84,000 / 8 * 12
    expect(r.confidence).toBe("high");
    expect(r.excludedCount).toBe(4); // 2 own-account transfers, 1 refund, 1 interest
    const payers = new Set(r.transactions.map((t) => t.payer));
    expect(payers).toEqual(new Set(["ACME SOFTWARE LLC", "SQUARE INC", "Brightline Studio, LLC"]));
    expect(r.transactions.every((t) => t.amount > 0)).toBe(true);
    expect(r.transactions.some((t) => /transfer|refund|interest/i.test(t.payer))).toBe(false);
  });

  it("finds columns in any order and case, ISO dates, quoted amounts", () => {
    const csv = [
      "AMOUNT,Memo,Transaction Date",
      '"$1,500.00",Payment from Client A,2026-01-10',
      "200,Zelle to self,2026-01-12",
      "(50.00),Coffee,2026-02-01",
      "900,Wire transfer from Client B,2026-02-15",
    ].join("\r\n");
    const r = parseIncomeCsv(csv);
    expect(r.transactions).toEqual([
      { date: "2026-01-10", amount: 1500, payer: "Client A" },
      { date: "2026-02-15", amount: 900, payer: "Client B" },
    ]);
    expect(r.months).toBe(2);
    expect(r.confidence).toBe("low");
    expect(r.projectedAnnualIncome).toBe(14400); // 2,400 / 2 * 12
  });

  it("errors clearly when a column is missing", () => {
    expect(() => parseIncomeCsv("Date,Amount\n2026-01-01,10")).toThrow(ParseIncomeError);
    expect(() => parseIncomeCsv("Date,Amount\n2026-01-01,10")).toThrow(/description/);
    expect(() => parseIncomeCsv("")).toThrow(ParseIncomeError);
  });

  it("confidence thresholds: <3 low, 3–6 medium, >6 high", () => {
    expect(confidenceFor(2)).toBe("low");
    expect(confidenceFor(3)).toBe("medium");
    expect(confidenceFor(6)).toBe("medium");
    expect(confidenceFor(7)).toBe("high");
  });

  it("parses amount and date formats", () => {
    expect(parseAmount("$1,234.56")).toBe(1234.56);
    expect(parseAmount("(12.00)")).toBe(-12);
    expect(parseAmount("abc")).toBeNaN();
    expect(parseDate("3/5/26")).toBe("2026-03-05");
    expect(parseDate("13/01/2026")).toBeNull();
  });
});
