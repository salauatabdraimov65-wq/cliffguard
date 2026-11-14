import { CheckoutConfigError, createCheckoutUrl, type Interval } from "@/lib/checkout";

// POST /api/checkout  body (optional): { interval?: "year" | "month" }  -> 200 { url } | 4xx/5xx { error }
export async function POST(request: Request) {
  let interval: Interval = "year";
  const text = await request.text();
  if (text) {
    try {
      const body = JSON.parse(text) as { interval?: unknown };
      if (body.interval !== undefined) {
        if (body.interval !== "year" && body.interval !== "month") {
          return Response.json({ error: 'interval must be "year" or "month".' }, { status: 400 });
        }
        interval = body.interval;
      }
    } catch {
      return Response.json({ error: "Body must be valid JSON." }, { status: 400 });
    }
  }

  try {
    const url = await createCheckoutUrl(new URL(request.url).origin, interval);
    return Response.json({ url });
  } catch (e) {
    if (e instanceof CheckoutConfigError) {
      return Response.json({ error: e.message }, { status: 503 });
    }
    console.error("Stripe checkout failed", e);
    return Response.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
