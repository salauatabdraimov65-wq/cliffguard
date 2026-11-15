import { describe, it, expect, vi, afterEach } from "vitest";
import { calculate } from "../lib/engine";
import { explainPlan, templateExplanation, usesOnlyKnownNumbers, planFacts, DISCLAIMER } from "../lib/explain";
import { demoFamily } from "../lib/demoFamily";

const demo = calculate(demoFamily, { today: "2026-11-15" });
// OpenAI returns the structured output as a JSON string in message.content
const okResponse = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ explanation: text }) } }] }), { status: 200 });

afterEach(() => vi.unstubAllEnvs());

describe("explainPlan", () => {
  it("no OPENAI_API_KEY: deterministic template with 10,561 and 4,500", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchImpl = vi.fn();
    const r = await explainPlan(demo, demoFamily, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.source).toBe("template");
    expect(r.explanation).toContain("$10,561");
    expect(r.explanation).toContain("$4,500");
    expect(r.explanation).toContain("$131,500");
    expect(r.explanation.endsWith(DISCLAIMER)).toBe(true);
    expect(usesOnlyKnownNumbers(r.explanation, planFacts(demo, demoFamily))).toBe(true);
  });

  it("templates for the other cases use only Result numbers", () => {
    for (const income of [120000, 180000]) {
      const r = calculate({ ...demoFamily, income, netSelfEmploymentIncome: income }, { today: "2026-11-15" });
      const t = templateExplanation(r);
      expect(t.endsWith(DISCLAIMER)).toBe(true);
      expect(usesOnlyKnownNumbers(t, planFacts(r))).toBe(true);
    }
  });

  it("with a key: sends only numbers, low temperature, returns the AI text", async () => {
    const text = `Your income is $136,000, which is $4,000 over the $132,000 cliff. Putting $4,500 into a SEP IRA brings it to $131,500 and back an estimated $10,561 a year. ${DISCLAIMER}`;
    const fetchImpl = vi.fn(async () => okResponse(text));
    const r = await explainPlan(demo, demoFamily, { apiKey: "sk-test", fetchImpl });
    expect(r).toEqual({ explanation: text, source: "ai" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.temperature).toBeLessThanOrEqual(0.3);
    expect(sent.response_format.type).toBe("json_schema");
    expect(sent.response_format.json_schema.schema.required).toEqual(["explanation"]);
    expect(sent.messages[1].content).not.toMatch(/Report|Contribute|warning/i); // no free text from Result
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
  });

  it("AI invents a number -> template", async () => {
    const fetchImpl = vi.fn(async () => okResponse(`You could save $12,345 this year. ${DISCLAIMER}`));
    const r = await explainPlan(demo, demoFamily, { apiKey: "sk-test", fetchImpl });
    expect(r.source).toBe("template");
  });

  it("adds the disclaimer if the model forgot it", async () => {
    const fetchImpl = vi.fn(async () => okResponse("Put $4,500 into a SEP IRA to keep $10,561 a year."));
    const r = await explainPlan(demo, demoFamily, { apiKey: "sk-test", fetchImpl });
    expect(r.source).toBe("ai");
    expect(r.explanation.endsWith(DISCLAIMER)).toBe(true);
  });

  it("not JSON for the schema -> template", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ choices: [{ message: { content: "plain text" } }] }), { status: 200 }),
    );
    expect((await explainPlan(demo, demoFamily, { apiKey: "k", fetchImpl })).source).toBe("template");
  });

  it("HTTP error, network error or timeout -> template", async () => {
    const bad = vi.fn(async () => new Response("nope", { status: 500 }));
    expect((await explainPlan(demo, demoFamily, { apiKey: "k", fetchImpl: bad })).source).toBe("template");
    const boom = vi.fn(async () => { throw new Error("ECONNRESET"); });
    expect((await explainPlan(demo, demoFamily, { apiKey: "k", fetchImpl: boom })).source).toBe("template");
    const slow = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("timeout")))),
    );
    const t0 = Date.now();
    const r = await explainPlan(demo, demoFamily, { apiKey: "k", fetchImpl: slow as unknown as typeof fetch, timeoutMs: 50 });
    expect(r.source).toBe("template");
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
