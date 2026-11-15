export type IncomeStability = "steady" | "uneven" | "lumpy";

export type Input = {
  householdSize: number;
  state: string;
  zip?: string;
  ages: number[];
  income: number;
  netSelfEmploymentIncome: number;
  benchmarkPremium: number;
  hsaEligible: boolean;
  coverageYear: 2027;
  incomeStability?: IncomeStability; // default "steady"; sets the safety cushion below the cliff
  actualPlanPremium?: number; // annual price of the plan actually bought, USD; default = benchmarkPremium
};

export type PlanStep = {
  account: "SEP_IRA" | "SOLO_401K" | "HSA" | "MARKETPLACE_UPDATE";
  amount: number;
  deadline: string;
  note: string;
};

export type Result = {
  fpl: number;
  cliff: number;
  magi: number;
  fplPercent: number;
  subsidy: number;
  overBy: number;
  loss: number;
  plan: PlanStep[];
  feasible: boolean;
  contributionNeeded: number;
  magiAfterPlan: number;
  subsidyAfterPlan: number;
  estTaxSavings: number;
  netBenefit: number;
  premiumYouPay: number; // annual: max(0, plan price - subsidy), before the plan
  premiumYouPayAfterPlan: number; // annual: max(0, plan price - subsidyAfterPlan)
  warnings: string[];
};
