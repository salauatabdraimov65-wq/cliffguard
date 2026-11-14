import { describe, it, expect } from "vitest";
import { projectYearEnd, topUpNeeded, monitorStatus } from "../lib/monitor";
import { demoMonthly } from "../lib/demoMonthly";
import { demoFamily } from "../lib/demoFamily";

describe("monitor", () => {
  it("projects year end: YTD + average × remaining months + known future", () => {
    expect(projectYearEnd([10000, 10000, 10000])).toBe(120000);
    expect(projectYearEnd(new Array(12).fill(10000), 5000)).toBe(125000);
    // demo: 84,200 YTD over 8 months -> avg 10,525 × 4 = 42,100 -> 126,300 + 12,000
    expect(projectYearEnd(demoMonthly.monthlyIncomes, demoMonthly.knownFuture.amount)).toBe(138300);
  });

  it("rejects bad input", () => {
    expect(() => projectYearEnd([])).toThrow(RangeError);
    expect(() => projectYearEnd(new Array(13).fill(1))).toThrow(RangeError);
    expect(() => projectYearEnd([NaN])).toThrow(RangeError);
  });

  it("top-up: 0 when the planned contribution already keeps MAGI under the cliff", () => {
    expect(topUpNeeded(136000, 4500, demoFamily)).toBe(0); // 131,500 < 132,000
    expect(topUpNeeded(120000, 0, demoFamily)).toBe(0);
  });

  it("top-up when income runs hot (demo): 138,300 - 4,500 = 133,800 -> +2,500", () => {
    expect(topUpNeeded(138300, 4500, demoFamily)).toBe(2500); // 1,800 over + 500 buffer -> 2,500
    expect(topUpNeeded(136000, 0, demoFamily)).toBe(4500); // same as the original plan
  });

  it("monitorStatus for the demo family", () => {
    const s = monitorStatus(
      demoMonthly.monthlyIncomes,
      demoMonthly.knownFuture.amount,
      demoMonthly.plannedContribution,
      demoFamily,
    );
    expect(s).toEqual({
      projectedIncome: 138300,
      cliff: 132000,
      projectedMagi: 133800,
      headroom: -1800,
      topUp: 2500,
      sepRoomLeft: 27200 - 4500 - 2500, // SEP cap = 20% of 136,000 net SE = 27,200
      feasible: true,
    });
  });
});
