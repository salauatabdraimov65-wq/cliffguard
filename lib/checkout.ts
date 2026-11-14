import Stripe from "stripe";

// Stripe Checkout, TEST MODE ONLY. Keys come from env (never committed):
//   STRIPE_SECRET_KEY     sk_test_... (required)
//   NEXT_PUBLIC_SITE_URL  optional; defaults to the request origin
export const PRICES = {
  year: { amount: 9900, label: "CliffGuard Pro — yearly" },
  month: { amount: 1299, label: "CliffGuard Pro — monthly" },
} as const;
export type Interval = keyof typeof PRICES;

export class CheckoutConfigError extends Error {}

export function getTestStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new CheckoutConfigError("Payments are not configured (STRIPE_SECRET_KEY missing).");
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new CheckoutConfigError("Only Stripe test-mode keys are allowed.");
  }
  return new Stripe(key);
}

export async function createCheckoutUrl(origin: string, interval: Interval = "year"): Promise<string> {
  const stripe = getTestStripe();
  const base = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, "");
  const price = PRICES[interval];
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: price.amount,
          recurring: { interval },
          product_data: { name: price.label },
        },
      },
    ],
    success_url: `${base}/plan?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/plan?canceled=1`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}
