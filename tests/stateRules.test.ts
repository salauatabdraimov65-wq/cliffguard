import { describe, it, expect } from "vitest";
import { calculate } from "../lib/engine";
import { stateRule, formatDate } from "../lib/stateRules";
import { demoFamily } from "../lib/demoFamily";
import type { Input } from "../lib/types";

const step = (r: ReturnType<typeof calculate>, acc: string) => r.plan.find((s) => s.account === acc);
const at = (input: Input, today: string) => calculate(input, { today });
const TODAY = "2026-11-14";

describe("state rules 2027", () => {
  it("open enrollment end by state, default Jan 15", () => {
    expect(stateRule("TX").openEnrollmentEnd).toBe("2027-01-15");
    expect(stateRule("ca").openEnrollmentEnd).toBe("2027-01-31");
    for (const s of ["NY", "DC", "RI"]) expect(stateRule(s).openEnrollmentEnd).toBe("2027-01-31");
    expect(stateRule("MA").openEnrollmentEnd).toBe("2027-01-23");
    expect(stateRule("VA").openEnrollmentEnd).toBe("2027-01-29");
    expect(stateRule("ID").openEnrollmentEnd).toBe("2026-12-15");
    expect(stateRule("NM")).toEqual({ openEnrollmentEnd: "2027-01-15", stateSubsidy: true });
    expect(stateRule("ZZ").openEnrollmentEnd).toBe("2027-01-15");
    expect(formatDate("2027-01-31")).toBe("Jan 31, 2027");
  });

  it("MARKETPLACE_UPDATE deadline comes from the state", () => {
    expect(step(at(demoFamily, TODAY), "MARKETPLACE_UPDATE")!.deadline).toBe("by Jan 15, 2027");
    expect(step(at({ ...demoFamily, state: "CA" }, TODAY), "MARKETPLACE_UPDATE")!.deadline).toBe("by Jan 31, 2027");
    expect(step(at({ ...demoFamily, state: "ID" }, TODAY), "MARKETPLACE_UPDATE")!.deadline).toBe("by Dec 15, 2026");
    expect(step(at({ ...demoFamily, state: "MA" }, TODAY), "MARKETPLACE_UPDATE")!.deadline).toBe("by Jan 23, 2027");
  });

  it("New Mexico warning; other states have none", () => {
    expect(at({ ...demoFamily, state: "NM" }, TODAY).warnings).toContain(
      "New Mexico funds its own extra subsidy — your real loss may be smaller.",
    );
    expect(at(demoFamily, TODAY).warnings).toEqual([]);
    // cheap plan in NM: the cheap-plan explanation stays first (UI shows warnings[0])
    const cheapNM = at({ ...demoFamily, state: "NM", householdSize: 1, ages: [30], income: 65000, benchmarkPremium: 6000 }, TODAY);
    expect(cheapNM.warnings[0]).toMatch(/benchmark plan is cheap/);
    expect(cheapNM.warnings[1]).toMatch(/New Mexico/);
  });

  it("the deadline day itself still counts; the next day shows the next step", () => {
    expect(step(at(demoFamily, "2027-01-15"), "MARKETPLACE_UPDATE")!.deadline).toBe("by Jan 15, 2027");
    const after = step(at(demoFamily, "2027-01-16"), "MARKETPLACE_UPDATE")!;
    expect(after.deadline).toBe("as soon as possible");
    expect(after.note).toMatch(/Open enrollment has ended; update your 2027 income to \$131,500/);
    // Idaho closes earlier
    expect(step(at({ ...demoFamily, state: "ID" }, "2026-12-16"), "MARKETPLACE_UPDATE")!.deadline).toBe(
      "as soon as possible",
    );
  });
});

describe("plan deadlines relative to today", () => {
  it("demo before 2027: SEP $375/month over 12 months, due with the 2027 return", () => {
    const sep = step(at(demoFamily, TODAY), "SEP_IRA")!;
    expect(sep.amount).toBe(4500);
    expect(sep.deadline).toBe("before you file your 2027 tax return (by Apr 15, 2028)");
    expect(sep.note).toBe("Contribute $4,500 to a SEP IRA (about $375/month).");
  });

  it("mid-2027: monthly amount spread over the months left", () => {
    // October -> Oct, Nov, Dec = 3 months
    expect(step(at(demoFamily, "2027-10-01"), "SEP_IRA")!.note).toBe("Contribute $4,500 to a SEP IRA (about $1,500/month).");
    // after 2027: no monthly split
    expect(step(at(demoFamily, "2028-02-01"), "SEP_IRA")!.note).toBe("Contribute $4,500 to a SEP IRA.");
  });

  it("after Apr 15, 2028: HSA closed, SEP only with an extension", () => {
    const hsaFamily = { ...demoFamily, netSelfEmploymentIncome: 10000, hsaEligible: true };
    // before: SEP 2,000 + HSA 2,500
    const before = at(hsaFamily, TODAY);
    expect(step(before, "HSA")!.deadline).toBe("by Apr 15, 2028");
    // after the filing deadline the HSA is closed and SEP alone (2,000) is not enough
    const after = at(hsaFamily, "2028-05-01");
    expect(after.feasible).toBe(false);
    expect(step(after, "HSA")).toBeUndefined();
    // demo family (SEP only) still can contribute with an extension
    const ext = step(at(demoFamily, "2028-05-01"), "SEP_IRA")!;
    expect(ext.deadline).toBe("by Oct 15, 2028, only if you filed a tax extension");
  });

  it("after Oct 15, 2028: nothing left to contribute", () => {
    const r = at(demoFamily, "2028-10-16");
    expect(r.feasible).toBe(false);
    expect(r.plan.map((s) => s.account)).toEqual(["MARKETPLACE_UPDATE"]);
    expect(r.warnings).toContain("The deadline for 2027 contributions has passed.");
  });

  it("default today = current date; numbers unchanged", () => {
    const r = calculate(demoFamily);
    expect(r.loss).toBe(10510);
    expect(r.subsidyAfterPlan).toBe(10561);
  });

  it("which Input fields matter: zip and coverageYear do not change the result", () => {
    const base = at(demoFamily, TODAY);
    expect(at({ ...demoFamily, zip: "10001" }, TODAY)).toEqual(base);
    const noZip: Input = { ...demoFamily };
    delete noZip.zip;
    expect(at(noZip, TODAY)).toEqual(base);
    // ages matter only for the HSA 55+ catch-up
    expect(at({ ...demoFamily, ages: [60, 58, 8, 5] }, TODAY)).toEqual(base);
    // ...where a 55+ member adds $1,000 of HSA room: 9,500 needed vs 9,000 family limit
    const hsaOnly = { ...demoFamily, income: 141000, netSelfEmploymentIncome: 0, hsaEligible: true };
    expect(at(hsaOnly, TODAY).feasible).toBe(false);
    expect(at({ ...hsaOnly, ages: [56, 36, 8, 5] }, TODAY).feasible).toBe(true);
  });
});
