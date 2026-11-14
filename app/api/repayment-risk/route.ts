import { checkRepayment2026, RepaymentInputError, validateRepaymentInput } from "@/lib/repayment";

// POST /api/repayment-risk  body: RepaymentInput  -> 200 RepaymentResult | 400 { error }
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be valid JSON." }, { status: 400 });
  }
  try {
    return Response.json(checkRepayment2026(validateRepaymentInput(body)));
  } catch (e) {
    if (e instanceof RepaymentInputError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
