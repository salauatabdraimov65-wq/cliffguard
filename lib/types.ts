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
  warnings: string[];
};
