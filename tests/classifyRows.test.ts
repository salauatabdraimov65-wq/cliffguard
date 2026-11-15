import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { classifyAmbiguous } from "../lib/classifyRows";
import { isAmbiguous, parseIncomeCsv, parseIncomeRows, summarizeIncome } from "../lib/parseIncome";

afterEach(() => vi.unstubAllEnvs());

const CSV = [
  "Date,Description,Amount",
  "2026-01-05,ACH DEPOSIT ACME SOFTWARE LLC,5000",
  "2026-01-10,Wire Transfer - Harbor Health Inc,3000",
  "2026-01-12,Zelle Transfer - Harbor Health Inc,1200",
  "2026-01-20,Online Transfer from Savings x4821,2000",
  "2026-02-03,Zelle from Mom,500",
  "2026-02-10,Refund - Office Depot,86.40",
  "2026-02-15,Rent,-2400",
].join("\n");

const reply = (items: { id: number; category: string }[]) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items }) } }] }), { status: 200 });

describe("ambiguous rows", () => {
  it("rules flag wires, Zelle and 'Transfer - <company>' as ambiguous, not plain transfers", () => {
    expect(isAmbiguous("Wire Transfer - Harbor Health Inc")).toBe(true);
    expect(isAmbiguous("Zelle Transfer - Harbor Health Inc")).toBe(true);
    expect(isAmbiguous("Zelle from Mom")).toBe(true);
    expect(isAmbiguous("Zelle to self - Jess personal")).toBe(false);
    expect(isAmbiguous("Online Transfer from Savings x4821")).toBe(false);
    expect(isAmbiguous("ACH DEPOSIT ACME SOFTWARE LLC")).toBe(false);
  });

  it("'Wire Transfer - Harbor Health Inc' -> income (AI), and the AI can overrule the rules", async () => {
    const { rows, months } = parseIncomeRows(CSV);
    const ids = Object.fromEntries(rows.map((r, i) => [r.description, i]));
    // before AI: the rules drop "Zelle Transfer - <company>" (contains 'transfer')
    expect(rows[ids["Zelle Transfer - Harbor Health Inc"]].excluded).toBe(true);

    const fetchImpl = vi.fn(async () =>
      reply([
        { id: ids["Wire Transfer - Harbor Health Inc"], category: "income" },
        { id: ids["Zelle Transfer - Harbor Health Inc"], category: "income" },
        { id: ids["Zelle from Mom"], category: "own_transfer" },
      ]),
    );
    const c = await classifyAmbiguous(rows, { apiKey: "k", fetchImpl });
    expect(c.source).toBe("ai");
    expect(c.aiClassified).toBe(3);

    // only the ambiguous rows were sent, descriptions + amounts only
    const sent = JSON.parse(JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).messages[1].content);
    expect(sent.rows.map((r: { description: string }) => r.description).sort()).toEqual(
      ["Wire Transfer - Harbor Health Inc", "Zelle Transfer - Harbor Health Inc", "Zelle from Mom"].sort(),
    );
    expect(Object.keys(sent.rows[0]).sort()).toEqual(["amount", "description", "id"]);

    const s = summarizeIncome(c.rows, months);
    const payers = s.transactions.map((t) => t.payer);
    expect(payers.filter((p) => p === "Harbor Health Inc")).toHaveLength(2); // wire + Zelle, prefixes cleaned
    expect(payers).not.toContain("Mom");
    // totals are computed by us: 5,000 + 3,000 + 1,200
    expect(s.transactions.reduce((a, t) => a + t.amount, 0)).toBe(9200);
  });

  it("no key -> exactly the rules' result", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchImpl = vi.fn();
    const { rows, months } = parseIncomeRows(CSV);
    const c = await classifyAmbiguous(rows, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(c.source).toBe("rules");
    expect(summarizeIncome(c.rows, months)).toEqual(parseIncomeCsv(CSV));
    // the rules already keep the wire from a company as income
    expect(parseIncomeCsv(CSV).transactions.map((t) => t.payer)).toContain("Harbor Health Inc");
  });

  it("bad AI output (unknown ids, bad category, error, timeout) -> rules kept", async () => {
    const { rows } = parseIncomeRows(CSV);
    const junk = vi.fn(async () => reply([{ id: 999, category: "income" }, { id: 0, category: "salary" }]));
    expect((await classifyAmbiguous(rows, { apiKey: "k", fetchImpl: junk })).source).toBe("rules");
    const boom = vi.fn(async () => { throw new Error("down"); });
    expect((await classifyAmbiguous(rows, { apiKey: "k", fetchImpl: boom })).source).toBe("rules");
    const slow = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("timeout")))),
    );
    expect((await classifyAmbiguous(rows, { apiKey: "k", fetchImpl: slow as unknown as typeof fetch, timeoutMs: 50 })).source).toBe("rules");
  });

  it("demo bank CSV without a key is unchanged ($126,000/yr)", () => {
    const r = parseIncomeCsv(readFileSync("public/demo-bank.csv", "utf8"));
    expect(r.projectedAnnualIncome).toBe(126000);
    expect(r.transactions).toHaveLength(22);
  });
});
