// Deterministic bank-CSV parser: no LLM, no network, nothing stored.
// Finds date / amount / description columns, keeps incoming client payments,
// drops transfers between own accounts, refunds and interest, and projects annual income.

export type IncomeTransaction = { date: string; amount: number; payer: string };
export type Confidence = "low" | "medium" | "high";
export type ParsedIncome = {
  transactions: IncomeTransaction[];
  projectedAnnualIncome: number;
  confidence: Confidence;
  months: number;
  excludedCount: number;
};

export class ParseIncomeError extends Error {}

const DATE_HEADERS = /^(date|transaction date|posted date|posting date|trans date|value date|booking date)$/;
const AMOUNT_HEADERS = /^(amount|transaction amount|amount \(usd\)|amt|credit|deposit|deposits|credits)$/;
const DESC_HEADERS = /^(description|desc|memo|details|payee|payer|name|narrative|transaction description)$/;

// Incoming money that is not client income.
const EXCLUDE = [
  /(?<!wire )\btransfers?\b/i, // "Wire transfer from <client>" is income
  /\bxfer\b/i,
  /\bzelle (to|from) (self|me|myself)\b/i,
  /\b(own|my) account\b/i,
  /\b(from|to) (my )?(savings|checking)\b/i,
  /\binternal\b/i,
  /\brefund(ed)?\b/i,
  /\breversal\b/i,
  /\bchargeback\b/i,
  /\binterest\b/i,
  /\bcashback\b/i,
];

const PAYER_PREFIXES =
  /^(ach (credit|deposit)|direct dep(osit)?|zelle (payment )?from|payment from|wire (transfer )?from|mobile deposit|deposit from|deposit)\s*[-:]?\s*/i;

/** RFC 4180-ish CSV: quoted fields, escaped quotes, commas/newlines inside quotes, CRLF. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** "$1,234.56" | "-12.00" | "(12.00)" | "1 234,56"-free US formats -> number, NaN if unparsable. */
export function parseAmount(raw: string): number {
  let t = raw.trim().replace(/[$\s]/g, "").replace(/,/g, "");
  let sign = 1;
  if (/^\(.*\)$/.test(t)) {
    sign = -1;
    t = t.slice(1, -1);
  }
  if (/CR$/i.test(t)) t = t.slice(0, -2);
  else if (/DR$/i.test(t)) {
    sign = -sign;
    t = t.slice(0, -2);
  }
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return NaN;
  return sign * Number(t);
}

/** ISO YYYY-MM-DD, MM/DD/YYYY, M/D/YY -> "YYYY-MM-DD", or null. */
export function parseDate(raw: string): string | null {
  const t = raw.trim();
  let y: number, m: number, d: number;
  let mt = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (mt) [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  else if ((mt = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t))) {
    [m, d, y] = [+mt[1], +mt[2], +mt[3]];
    if (y < 100) y += 2000;
  } else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function cleanPayer(description: string): string {
  const p = description
    .replace(PAYER_PREFIXES, "")
    .replace(/\s+(deposit|payout|payment)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return p || description.trim();
}

export function isExcluded(description: string): boolean {
  return EXCLUDE.some((re) => re.test(description));
}

export function confidenceFor(months: number): Confidence {
  if (months < 3) return "low";
  if (months <= 6) return "medium";
  return "high";
}

const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");

export function parseIncomeCsv(csv: string): ParsedIncome {
  if (typeof csv !== "string" || !csv.trim()) throw new ParseIncomeError("CSV is empty.");
  const firstLine = csv.split(/\r?\n/, 1)[0];
  const delimiter = !firstLine.includes(",") && firstLine.includes(";") ? ";" : ",";
  const rows = parseCsv(csv, delimiter);
  if (rows.length < 2) throw new ParseIncomeError("CSV needs a header row and at least one transaction.");

  const header = rows[0].map(norm);
  const find = (re: RegExp, loose: string) => {
    const exact = header.findIndex((h) => re.test(h));
    return exact >= 0 ? exact : header.findIndex((h) => h.includes(loose));
  };
  const iDate = find(DATE_HEADERS, "date");
  const iAmount = find(AMOUNT_HEADERS, "amount");
  const iDesc = find(DESC_HEADERS, "description");
  const missing = [iDate < 0 && "date", iAmount < 0 && "amount", iDesc < 0 && "description"].filter(Boolean);
  if (missing.length) throw new ParseIncomeError(`Could not find column(s): ${missing.join(", ")}.`);

  const transactions: IncomeTransaction[] = [];
  const allDates: string[] = [];
  let excludedCount = 0;

  for (const r of rows.slice(1)) {
    const date = parseDate(r[iDate] ?? "");
    const amount = parseAmount(r[iAmount] ?? "");
    const desc = (r[iDesc] ?? "").trim();
    if (!date || Number.isNaN(amount)) continue;
    allDates.push(date);
    if (amount <= 0) continue;
    if (isExcluded(desc)) {
      excludedCount++;
      continue;
    }
    transactions.push({ date, amount: Math.round(amount * 100) / 100, payer: cleanPayer(desc) });
  }

  if (!allDates.length) throw new ParseIncomeError("No rows with a valid date and amount.");

  // Statement period in calendar months, inclusive (Mar..Oct = 8).
  allDates.sort();
  const [y1, m1] = allDates[0].split("-").map(Number);
  const [y2, m2] = allDates[allDates.length - 1].split("-").map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) + 1;

  transactions.sort((a, b) => a.date.localeCompare(b.date));
  const total = transactions.reduce((s, t) => s + t.amount, 0);

  return {
    transactions,
    projectedAnnualIncome: Math.round((total / months) * 12),
    confidence: confidenceFor(months),
    months,
    excludedCount,
  };
}
