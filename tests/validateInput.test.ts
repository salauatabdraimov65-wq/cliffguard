import { describe, it, expect } from "vitest";
import { validateInput } from "../lib/validateInput";
import { demoFamily } from "../lib/demoFamily";

describe("validateInput", () => {
  it("accepts the demo family", () => {
    const v = validateInput(JSON.parse(JSON.stringify(demoFamily)));
    expect(v.ok).toBe(true);
  });
  it("rejects non-objects and bad fields", () => {
    expect(validateInput(null).ok).toBe(false);
    expect(validateInput([]).ok).toBe(false);
    expect(validateInput({ ...demoFamily, householdSize: 9 }).ok).toBe(false);
    expect(validateInput({ ...demoFamily, income: "136000" }).ok).toBe(false);
    expect(validateInput({ ...demoFamily, ages: [38, 36] }).ok).toBe(false);
    expect(validateInput({ ...demoFamily, coverageYear: 2026 }).ok).toBe(false);
    expect(validateInput({ ...demoFamily, zip: "7870" }).ok).toBe(false);
  });
  it("normalises state to upper case", () => {
    const v = validateInput({ ...demoFamily, state: "tx" });
    expect(v.ok && v.input.state).toBe("TX");
  });
});
