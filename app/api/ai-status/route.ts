import { DEFAULT_OPENAI_MODEL, openAiError, redact } from "@/lib/explain";

// GET /api/ai-status -> is the AI configured on this deployment, and does OpenAI accept it?
// Uses GET /v1/models/{model}: free, generates nothing. Never returns the key itself.
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const configured = key.trim().length > 0;
  const base = {
    openaiKeyConfigured: configured,
    keyLooksValid: /^sk-[A-Za-z0-9_\-]{20,}$/.test(key.trim()),
    keyHasWhitespace: configured && key !== key.trim(),
    model,
  };
  if (!configured) {
    return Response.json({ ...base, ok: false, hint: "Add OPENAI_API_KEY to this Vercel project and redeploy." });
  }
  try {
    const res = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { authorization: `Bearer ${key.trim()}` },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (res.ok) return Response.json({ ...base, ok: true, check: "key accepted, model available" });
    const error = await openAiError(res);
    const hint =
      res.status === 401
        ? "OpenAI rejected the key: copy it again (no spaces) or create a new one."
        : res.status === 404
          ? "This model isn't available to your account: set OPENAI_MODEL to a model you have access to."
          : res.status === 429
            ? "Rate limit or no credit left on the OpenAI account (Settings → Billing)."
            : "OpenAI returned an error; see `error`.";
    return Response.json({ ...base, ok: false, error, hint });
  } catch (e) {
    return Response.json({ ...base, ok: false, error: redact(e instanceof Error ? e.message : "error"), hint: "Could not reach OpenAI." });
  }
}
