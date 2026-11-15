# CliffGuard

[![test](https://github.com/salauatabdraimov65-wq/cliffguard/actions/workflows/test.yml/badge.svg)](https://github.com/salauatabdraimov65-wq/cliffguard/actions/workflows/test.yml)

**Earn $1 more. Lose $10,500. We make sure that doesn't happen.**

**Live product: https://cliffguard.vercel.app** — no login. Click **“Try demo family”**, or jump straight in:

| What to see | Link |
|---|---|
| Diagnosis with the income slider + “Ask CliffGuard” | https://cliffguard.vercel.app/diagnosis?demo=1 |
| Rescue plan + “In plain English” explanation | https://cliffguard.vercel.app/plan?demo=1 |
| Year-round monitoring | https://cliffguard.vercel.app/monitor |
| Your own numbers (60-second quiz) | https://cliffguard.vercel.app/quiz |

CliffGuard is a web app for self-employed US families who buy health insurance on the ACA Marketplace (healthcare.gov and state exchanges).
Since January 1, 2026 the enhanced subsidies have expired and the **400% FPL “subsidy cliff”** is back: if household MAGI is even $1 above 400% of the Federal Poverty Level, the Premium Tax Credit drops to **$0**.

CliffGuard:

1. **Diagnoses** how much a family loses by crossing the cliff (with an interactive income slider).
2. **Plans** a legal way back under it — pre-tax contributions to a **SEP IRA** and an **HSA** lower MAGI.
3. **Monitors** income through the year so the family doesn't have to repay subsidies when they file taxes.
4. **Explains and answers** with AI: a plain-English summary of the plan, “Ask CliffGuard” what-ifs (“What if I earn $8,000 more?”), and a second look at unclear bank-statement rows. **The AI never computes a number**: every figure comes from our engine, and answers containing any other number are rejected.

> CliffGuard is an **educational estimate**. It does not sell insurance, open accounts, move money, or give tax advice. Confirm with a tax professional.

### Demo family: Mike & Jess (Austin, TX, family of 4)

| | Before | After plan |
|---|---|---|
| Expected 2027 income (MAGI) | $136,000 | $131,500 |
| Cliff (400% FPL) | $132,000 | $132,000 |
| Annual subsidy | $0 | ~$10,561 |
| Plan | — | $4,500 into a SEP IRA |
| Est. federal tax saving (22%) | — | ~$990 |

Benchmark silver plan in the demo: $24,000/year (illustrative).

---

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run build    # production build
```

Optional environment variables (copy `.env.example` to `.env.local`; never commit real keys):

| Variable | Used for |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Checkout, **test mode only** (`sk_test_…`; live keys are rejected) |
| `NEXT_PUBLIC_SITE_URL` | Base URL for Stripe redirects (defaults to the request origin) |
| `OPENAI_API_KEY` | AI features (plan explanation, Ask CliffGuard, unclear CSV rows). Server-only. Without it every feature still works with deterministic templates and rules |
| `OPENAI_MODEL` | Optional, default `gpt-4o-mini` |

## Where the math lives

| File | What it does |
|---|---|
| [`lib/engine.ts`](lib/engine.ts) | `fpl()`, `applicablePct()`, `subsidyFor()`, `calculate(input): Result` |
| [`lib/optimizer.ts`](lib/optimizer.ts) | Smallest SEP IRA → HSA contribution that brings MAGI under the cliff |
| [`lib/types.ts`](lib/types.ts) | Shared `Input` / `Result` / `PlanStep` contract |
| [`lib/repayment.ts`](lib/repayment.ts) | Tax-year 2026 repayment risk (APTC on estimated vs PTC on actual income) |
| [`lib/monitor.ts`](lib/monitor.ts) | Year-end income projection and SEP IRA top-up for the monitoring screen |
| [`lib/parseIncome.ts`](lib/parseIncome.ts) | Deterministic bank-CSV parser and annual income projection |
| [`data/`](data) | Tables: FPL, applicable percentages, contribution limits |
| [`tests/`](tests) | Unit tests, including the demo family |

Core formula (coverage year 2027, 48 contiguous states + DC):

```
fpl     = 15,960 + 5,680 × (household size − 1)
cliff   = 4 × fpl
if MAGI > cliff:  subsidy = 0
else:             subsidy = max(0, benchmark silver premium − applicable% × MAGI)
```

`applicable%` is interpolated linearly inside each FPL band (2.15% → 10.22%).
The optimizer rounds the needed contribution up to $500 with a $500 safety buffer, fills the SEP IRA first (simplified as 20% of net self-employment income), then the HSA. Traditional IRA is intentionally not used: once you contribute to a SEP IRA, the IRA deduction for a couple at this income is partly or fully phased out.

## API

| Endpoint | Body | Response |
|---|---|---|
| `POST /api/calc` | `Input` (see `lib/types.ts`) | `Result`, or `400 { error }` |
| `POST /api/parse-income` | `{ csv: string }` | `{ transactions: {date, amount, payer}[], projectedAnnualIncome, confidence, months, excludedCount, explanation? }` |
| `POST /api/repayment-risk` | `{ householdSize, estimatedIncome, actualIncome, benchmarkPremium2026, netSelfEmploymentIncome, hsaEligible, ages? }` | Tax-year 2026 APTC repayment check: `{ aptcReceived, ptcAllowed, repaymentOwed, contributionToAvoid, repaymentAfterFix, deadlines, … }` |
| `POST /api/explain` | `{ input }` | `{ explanation, source: "ai" \| "template", reason? }` — 3–4 plain-English sentences, numbers from the engine only |
| `POST /api/ask` | `{ input, question }` | `{ answer, scenario?: { input, result }, source: "ai" \| "rules", reason? }` — the model calls our `calculate` tool (max 3 times) |
| `GET /api/ai-status` | — | Is the OpenAI key set and accepted on this deployment (never returns the key) |
| `POST /api/checkout` | `{ interval?: "year" \| "month" }` | `{ url }` (Stripe Checkout, test mode) |

`/api/parse-income` keeps only incoming payments (> 0), drops transfers between your own accounts, refunds and interest, and projects `income / months × 12`. Confidence is `low` under 3 months, `medium` for 3–6 and `high` above 6. Nothing is stored. Sample file: [`public/demo-bank.csv`](public/demo-bank.csv) (8 months, $84,000 of client payments → $126,000/year).

## Data sources

| Table | Source |
|---|---|
| Applicable percentages 2027 (2.15%–10.22%) | IRS [Rev. Proc. 2026-26](https://www.irs.gov/pub/irs-drop/rp-26-26.pdf), §3.01 |
| Applicable percentages 2026 (2.10%–9.96%) | IRS Rev. Proc. 2025-25 |
| FPL for 2026 coverage (repayment check) | HHS 2025 poverty guidelines |
| APTC repayment cap repealed from tax year 2026 | OBBBA §71305 |
| Federal Poverty Level (used for 2027 coverage) | HHS 2026 poverty guidelines |
| HSA limits 2027 ($4,500 self / $9,000 family, +$1,000 at 55+) | IRS Rev. Proc. 2026-24 |
| Bronze & catastrophic plans are HSA-eligible from 2026 | IRS Notice 2026-5 |
| 401(k) / SEP limits | 2026 IRS figures; 2027 limits not yet published |

## MVP limitations

- **Alaska and Hawaii are not supported** (they have their own FPL tables); the app shows a warning.
- **Medicaid is not modelled**: below 100% FPL the app shows a warning instead of a subsidy.
- **State income taxes are not included**; the tax saving is a federal estimate at a flat 22%.
- Cost-sharing reductions are out of scope.
- SEP IRA capacity is simplified to 20% of net self-employment income.
- 2027 retirement-plan limits are not yet published by the IRS; 2026 values are used.

## Tech

Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel. Vitest for tests. Stripe Checkout in test mode.

Built for Zimran Business Cup 2.0 (Money track), November 2026.
