// Illustrative monitoring data for the demo family (Mike & Jess), coverage year 2027.
// Jan–Aug actual income, plus a signed Q4 client contract on top of the usual run-rate.
export const demoMonthly = {
  year: 2027 as const,
  monthlyIncomes: [9800, 10400, 8900, 11200, 9600, 12100, 10300, 11900], // Jan..Aug, sum 84,200
  knownFuture: { label: "Q4 client contract", amount: 12000 }, // illustrative
  plannedContribution: 4500, // SEP IRA from the original plan
};
