import { parseIncomeRows, ParseIncomeError, summarizeIncome } from "@/lib/parseIncome";
import { classifyAmbiguous } from "@/lib/classifyRows";
import { explainIncome } from "@/lib/incomeExplain";

const MAX_CSV_BYTES = 1_000_000;

// POST /api/parse-income  body: { csv: string }
// -> 200 { transactions: {date, amount, payer}[], projectedAnnualIncome, confidence, months, excludedCount,
//          aiClassified, explanation? }
// -> 400 { error }
// Keyword rules are the base; only ambiguous incoming rows go to the model (if OPENAI_API_KEY is set)
// for income | own_transfer | refund. Totals are always computed here. Nothing is stored.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be valid JSON: { csv: string }." }, { status: 400 });
  }
  const csv = (body as { csv?: unknown } | null)?.csv;
  if (typeof csv !== "string") {
    return Response.json({ error: "Body must be { csv: string }." }, { status: 400 });
  }
  if (csv.length > MAX_CSV_BYTES) {
    return Response.json({ error: "CSV is too large (max 1 MB)." }, { status: 400 });
  }

  try {
    const { rows, months } = parseIncomeRows(csv);
    const classified = await classifyAmbiguous(rows);
    const parsed = { ...summarizeIncome(classified.rows, months), aiClassified: classified.aiClassified };
    const explanation = await explainIncome(parsed);
    return Response.json(explanation ? { ...parsed, explanation } : parsed);
  } catch (e) {
    if (e instanceof ParseIncomeError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
