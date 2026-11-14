import { describe, it, expect, afterEach, vi } from "vitest";
import { getTestStripe, CheckoutConfigError, PRICES } from "../lib/checkout";

afterEach(() => vi.unstubAllEnvs());

describe("Stripe checkout config", () => {
  it("fails clearly without a key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(() => getTestStripe()).toThrow(CheckoutConfigError);
  });
  it("rejects live keys", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_x");
    expect(() => getTestStripe()).toThrow(/test-mode/);
  });
  it("accepts test keys", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    expect(() => getTestStripe()).not.toThrow();
  });
  it("prices match PROJECT.md ($99/yr, $12.99/mo)", () => {
    expect(PRICES.year.amount).toBe(9900);
    expect(PRICES.month.amount).toBe(1299);
  });
});
