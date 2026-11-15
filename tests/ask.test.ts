import { describe, it, expect, vi, afterEach } from "vitest";
import { askCliffGuard, parseWhatIf, rulesAnswer, applyChanges, OFF_TOPIC_ANSWER } from "../lib/ask";
import { calculate } from "../lib/engine";
import { DISCLAIMER } from "../lib/explain";
import { demoFamily } from "../lib/demoFamily";

const TODAY = "2026-11-15";
afterEach(() => vi.unstubAllEnvs());

const chat = (message: Record<string, unknown>) =>
  new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
const toolCall = (args: Record<string, unknown>, id = "call_1") =>
  chat({
    role: "assistant",
    content: null,
    tool_calls: [{ id, type: "function", function: { name: "calculate", arguments: JSON.stringify(args) } }],
  });
const final = (answer: string, off_topic = false) =>
  chat({ role: "assistant", content: JSON.stringify({ answer, off_topic }) });
const ALL_NULL = { income: null, netSelfEmploymentIncome: null, householdSize: null, hsaEligible: null, actualPlanPremium: null, incomeStability: null };

describe("Ask CliffGuard with function calling (mocked OpenAI)", () => {
  it("'what if I earn $8,000 more?' -> calls calculate with income 144,000 and answers from its result", async () => {
    const expected = calculate({ ...demoFamily, income: 144000, netSelfEmploymentIncome: 144000 }, { today: TODAY });
    expect(expected.overBy).toBe(12000);
    expect(expected.contributionNeeded).toBe(12500);
    expect(expected.loss).toBe(10510);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(toolCall({ ...ALL_NULL, income: 144000 }))
      .mockResolvedValueOnce(
        final(
          `At $144,000 you would be $12,000 over the $132,000 cliff and lose about $10,510 a year. Putting $12,500 into your plan's accounts brings you to $131,500 and keeps about $10,561. ${DISCLAIMER}`,
        ),
      );
    const r = await askCliffGuard(demoFamily, "what if I earn $8,000 more?", { apiKey: "k", fetchImpl, today: TODAY });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // the tool result sent back to the model comes from OUR engine
    const second = JSON.parse((fetchImpl.mock.calls[1][1] as RequestInit).body as string);
    const toolMsg = second.messages.find((m: { role: string }) => m.role === "tool");
    const facts = JSON.parse(toolMsg.content);
    expect(facts.expectedIncome).toBe(144000);
    expect(facts.contributionInPlan).toBe(12500);
    expect(facts.creditLostToTheCliff).toBe(10510);

    expect(r.source).toBe("ai");
    expect(r.scenario?.input.income).toBe(144000);
    expect(r.scenario?.result.contributionNeeded).toBe(12500);
    expect(r.answer).toContain("$12,500");
    expect(r.answer).toContain("$10,510");
    expect(r.answer.endsWith(DISCLAIMER)).toBe(true);

    const first = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(first.temperature).toBeLessThanOrEqual(0.3);
    expect(first.tools[0].function.name).toBe("calculate");
    expect(first.response_format.type).toBe("json_schema");
  });

  it("caps tool calls at 3, then forces a final answer", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(toolCall({ ...ALL_NULL, income: 140000 }, "a"))
      .mockResolvedValueOnce(toolCall({ ...ALL_NULL, income: 141000 }, "b"))
      .mockResolvedValueOnce(toolCall({ ...ALL_NULL, income: 142000 }, "c"))
      .mockResolvedValueOnce(final(`At $142,000 you are $10,000 over the cliff. ${DISCLAIMER}`));
    const r = await askCliffGuard(demoFamily, "try a few incomes", { apiKey: "k", fetchImpl, today: TODAY });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const last = JSON.parse((fetchImpl.mock.calls[3][1] as RequestInit).body as string);
    expect(last.tools).toBeUndefined(); // no more tool calls allowed
    expect(r.source).toBe("ai");
  });

  it("off-topic -> polite refusal", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(final("Paris is the capital of France.", true));
    const r = await askCliffGuard(demoFamily, "what is the capital of France?", { apiKey: "k", fetchImpl, today: TODAY });
    expect(r.answer).toBe(OFF_TOPIC_ANSWER);
  });

  it("model invents a number -> deterministic rules answer from the engine", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(toolCall({ ...ALL_NULL, income: 144000 }))
      .mockResolvedValueOnce(final(`You would save $99,999. ${DISCLAIMER}`));
    const r = await askCliffGuard(demoFamily, "what if I earn $8,000 more?", { apiKey: "k", fetchImpl, today: TODAY });
    expect(r.source).toBe("rules");
    expect(r.scenario?.input.income).toBe(144000);
  });

  it("error / timeout -> rules", async () => {
    const boom = vi.fn().mockRejectedValue(new Error("network"));
    expect((await askCliffGuard(demoFamily, "what if I earn $8,000 more?", { apiKey: "k", fetchImpl: boom, today: TODAY })).source).toBe("rules");
    const slow = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("timeout")))),
    );
    const r = await askCliffGuard(demoFamily, "what if I earn $8,000 more?", { apiKey: "k", fetchImpl: slow as unknown as typeof fetch, timeoutMs: 50, today: TODAY });
    expect(r.source).toBe("rules");
  });
});

describe("Ask CliffGuard without a key (rules)", () => {
  it("'what if I earn $8,000 more?' -> income 144,000, new plan from the engine", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const r = await askCliffGuard(demoFamily, "What if I earn $8,000 more?", { today: TODAY });
    expect(r.source).toBe("rules");
    expect(r.scenario?.input.income).toBe(144000);
    expect(r.scenario?.result.contributionNeeded).toBe(12500);
    expect(r.answer).toContain("$144,000");
    expect(r.answer).toContain("$12,500");
    expect(r.answer).toContain("$10,561");
    expect(r.answer.endsWith(DISCLAIMER)).toBe(true);
  });

  it("parses common what-ifs", () => {
    expect(parseWhatIf("what if I make 5k less", demoFamily)).toEqual({ income: 131000 });
    expect(parseWhatIf("what if my income is $150,000", demoFamily)).toEqual({ income: 150000 });
    expect(parseWhatIf("what if I pick a bronze plan?", demoFamily)).toEqual({ hsaEligible: true });
    expect(parseWhatIf("we're having a baby", demoFamily)).toEqual({ householdSize: 5 });
    expect(parseWhatIf("what if my plan costs $1,200 a month", demoFamily)).toEqual({ actualPlanPremium: 14400 });
    expect(parseWhatIf("tell me a joke", demoFamily)).toBeNull();
  });

  it("off-topic without a key -> refusal, no scenario", () => {
    const r = rulesAnswer(demoFamily, "who won the game?");
    expect(r.answer).toBe(OFF_TOPIC_ANSWER);
    expect(r.scenario).toBeUndefined();
  });

  it("applyChanges clamps values and adds a child's age", () => {
    const n = applyChanges(demoFamily, { householdSize: 12, income: -5 });
    expect(n.householdSize).toBe(8);
    expect(n.ages).toHaveLength(8);
    expect(n.income).toBe(0);
  });

  it("demo family itself is unchanged", () => {
    const r = calculate(demoFamily, { today: TODAY });
    expect([r.loss, r.contributionNeeded, r.subsidyAfterPlan]).toEqual([10510, 4500, 10561]);
  });
});
