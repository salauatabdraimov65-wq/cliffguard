import { askCliffGuard } from "@/lib/ask";
import { validateInput } from "@/lib/validateInput";

// POST /api/ask  body: { input: Input, question: string }
// -> 200 { answer, scenario?: { changes, input, result }, source: "ai" | "rules" } | 400 { error }
// Numbers always come from our engine (the model only calls the `calculate` tool).
export async function POST(request: Request) {
  let body: { input?: unknown; question?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Body must be valid JSON: { input, question }." }, { status: 400 });
  }
  const v = validateInput(body?.input);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  if (typeof body.question !== "string" || !body.question.trim()) {
    return Response.json({ error: "question must be a non-empty string." }, { status: 400 });
  }
  if (body.question.length > 500) {
    return Response.json({ error: "question is too long (max 500 characters)." }, { status: 400 });
  }
  return Response.json(await askCliffGuard(v.input, body.question));
}
