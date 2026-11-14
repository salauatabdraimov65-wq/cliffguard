import { calculate } from "@/lib/engine";
import { validateInput } from "@/lib/validateInput";

// POST /api/calc  body: Input  -> 200 Result | 400 { error }
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be valid JSON." }, { status: 400 });
  }
  const v = validateInput(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  return Response.json(calculate(v.input));
}
