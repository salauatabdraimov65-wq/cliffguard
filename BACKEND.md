# CliffGuard — BACKEND (логика, API, интеграции)

> Сначала прочитай `PROJECT.md`. Здесь — только задачи бэкенда.
> Цель: **точный, протестированный расчёт**, на котором держится 40% оценки («работает ли продукт»).

---

## 0. Роль и зона ответственности

- `src/lib/engine.ts`, `src/lib/optimizer.ts`, `src/data/*.json`, `src/app/api/*`, тесты.
- Интеграция с фронтом в **04:00** (замена `fakeCalc` на `engine`).
- Stripe, Resend, AI-разбор CSV — **после** ядра и только если есть время.

## 1. Задачи по приоритету

| # | Задача | Приоритет | Дедлайн |
|---|---|---|---|
| 1 | Next.js репо + деплой Vercel + `types.ts` + `demoFamily.ts` + `fakeCalc.ts` | P0 | 00:00 |
| 2 | Таблицы в JSON (`fpl-2026`, `applicable-pct-2027`, `limits-2027`) | P0 | 00:45 |
| 3 | `engine.ts` — `calculateSubsidy`, `calculate(input): Result` | P0 | 02:00 |
| 4 | `optimizer.ts` — минимальный взнос под обрыв | P0 | 03:00 |
| 5 | Юнит-тесты (раздел 5) — все зелёные | P0 | 03:45 |
| 6 | Интеграция с фронтом | P0 | 04:30 |
| 7 | `POST /api/calc` (для чистоты архитектуры; фронт может звать engine напрямую) | P1 | 05:00 |
| 8 | Stripe Checkout test mode → `/plan?paid=1` открывает Pro | P1 | 06:30 |
| 9 | AI: `POST /api/parse-income` — CSV → прогноз дохода | P2 | 07:30 |
| 10 | Resend: тестовое письмо «monthly cliff check» | P2 | 08:00 |
| 11 | README + чистка кода | P0 | 09:30 |

## 2. Данные (`src/data/*.json`)

```jsonc
// fpl-2026.json  (используется для покрытия 2027; 48 штатов + DC)
{ "year": 2026, "base": 15960, "perAdditional": 5680, "source": "HHS 2026 poverty guidelines" }
// fpl(n) = base + perAdditional * (n - 1)  →  n=4: 33,000 → cliff 132,000

// applicable-pct-2027.json  — Rev. Proc. 2026-26 (https://www.irs.gov/pub/irs-drop/rp-26-26.pdf)
// Структура: диапазоны FPL% с начальным и конечным процентом; внутри диапазона — линейная интерполяция.
{ "year": 2027, "source": "IRS Rev. Proc. 2026-26", "rows": [
  { "from": 0.00, "to": 1.33, "initial": 0.0215, "final": 0.0215 },
  // TODO(verify): строки 133–150, 150–200, 200–250, 250–300 — взять из rp-26-26.pdf
  { "from": 3.00, "to": 4.00, "initial": 0.1022, "final": 0.1022 }
]}

// limits-2027.json
{ "hsa": { "self": 4500, "family": 9000, "catchUp55": 1000 },          // Rev. Proc. 2026-24 (официально)
  "deferral401k": 24500,                                               // 2026, 2027 ещё не опубликован
  "sepPctOfNetSE": 0.20,                                               // упрощение: 20% чистого дохода от самозанятости
  "sep415cCap": 72000,                                                  // TODO(verify) лимит 2026
  "safetyBuffer": 500, "roundTo": 500, "taxRateEstimate": 0.22 }
```

> Если не успеваешь заполнить все строки applicable %: аудитория MVP у обрыва (300–400% FPL), где ставка постоянна **10.22%**. Нижние строки можно временно оставить с пометкой и честно сказать об этом в README.

## 3. `engine.ts`

```ts
export function fpl(householdSize: number): number
export function applicablePct(fplPercent: number): number            // интерполяция по таблице
export function subsidyFor(magi: number, householdSize: number, benchmark: number): number
//  magi > 4*fpl → 0; иначе max(0, benchmark - applicablePct(magi/fpl) * magi)
export function calculate(input: Input): Result                       // вызывает optimizer
```

Правила:
- Все суммы округлять до целых долларов **только на выходе**.
- `fplPercent < 1.0` → `warnings.push("Income below 100% FPL — you may qualify for Medicaid instead.")`, субсидию не считать.
- `state` ∈ {AK, HI} → `warnings.push("Alaska and Hawaii are not supported yet.")`.
- `loss` = `subsidyFor(cliff, ...)` если `magi > cliff`, иначе 0. Если `loss == 0` (дешёвый план) → план не нужен, `warnings.push("Crossing the cliff costs you little because your benchmark plan is cheap.")`.

## 4. `optimizer.ts`

**Цель:** минимальный суммарный взнос, чтобы `magiAfter ≤ cliff`, с запасом `safetyBuffer`.

```
if magi <= cliff: plan = [MARKETPLACE_UPDATE(amount 0)]; feasible = true; return
needed = ceil((overBy + safetyBuffer) / roundTo) * roundTo
capacity:
  sep = min(sepPctOfNetSE * netSelfEmploymentIncome, sep415cCap)
  hsa = hsaEligible ? (householdSize > 1 ? family : self) (+catchUp если кому-то ≥55) : 0
порядок рычагов: SEP_IRA → HSA   (Traditional IRA — НЕ использовать, см. PROJECT.md §11.4)
распределить needed по рычагам в этом порядке
feasible = needed <= sep + hsa
magiAfter = magi - totalContribution
subsidyAfter = subsidyFor(magiAfter, ...)
estTaxSavings = round(totalContribution * taxRateEstimate)
netBenefit = subsidyAfter - subsidy + estTaxSavings
plan steps (EN):
  1. MARKETPLACE_UPDATE: "Report $<magiAfter> as your 2027 income on your Marketplace application" — "by Dec 15, 2026"
  2. SEP_IRA: "Contribute $<x> (about $<x/12>/month)" — "before you file your 2027 tax return"
  3. HSA (если есть): "Contribute $<y> to an HSA (requires a bronze or catastrophic plan)" — "by Apr 15, 2028"
if !feasible: warnings.push("Even maximum contributions can't bring you under the cliff this year.")
```

## 5. Обязательные тесты (Vitest/Jest)

Все — покрытие 2027, 48 штатов. Ставка в диапазоне 300–400% = 10.22%.

| # | Вход | Ожидание |
|---|---|---|
| 1 | **Демо:** n=4, income 136,000, netSE 136,000, benchmark 24,000, hsaEligible=false | cliff 132,000 · subsidy 0 · overBy 4,000 · loss ≈ 10,510 · SEP 4,500 · magiAfter 131,500 · subsidyAfter ≈ 10,561 · estTax 990 · feasible |
| 2 | n=4, income 120,000, benchmark 24,000 | subsidy ≈ 11,736 · overBy 0 · план = только MARKETPLACE_UPDATE |
| 3 | n=1, income 65,000, benchmark 6,000 | cliff 63,840 · overBy 1,160 · loss 0 (план дешёвый) · warning про дешёвый план |
| 4 | n=4, income 180,000, netSE 180,000, benchmark 24,000, hsaEligible=true | needed 48,500 > SEP 36,000 + HSA 9,000 → **feasible=false** + warning |
| 5 | n=3, income 110,000, benchmark 18,000 | cliff 109,280 · overBy 720 · loss ≈ 6,832 · SEP 1,500 · magiAfter 108,500 · subsidyAfter ≈ 6,911 |
| 6 | n=4, income 136,000, hsaEligible=true, netSE 10,000 | SEP 2,000 (20% от 10k) + HSA 2,500 = 4,500 · feasible |
| 7 | state="AK" | warning «not supported» |

## 6. API

```
POST /api/calc            body: Input            → 200 Result | 400 {error}
POST /api/parse-income    body: { csv: string }  → { transactions: {date, amount, payer}[], projectedAnnualIncome: number, confidence: "low"|"medium"|"high" }
POST /api/checkout        → { url }  (Stripe Checkout, test mode, $99/year)
POST /api/notify-test     body: { email }  → отправляет тестовое письмо через Resend
```

**AI-разбор CSV (P2):**
- Модель со structured output, JSON schema как выше. Отбирать только **входящие платежи от клиентов** (не переводы между своими счетами, не возвраты).
- Прогноз: `сумма за прошедшие месяцы / число месяцев × 12`; пометить `confidence`.
- Данные **не сохранять** без явного согласия; в демо — встроенный пример CSV.
- Ключи только в env (`.env.local`, Vercel env), никогда в репо.

## 7. Definition of Done

- [ ] Все 7 тестов зелёные, `npm test` в README.
- [ ] Демо-семья даёт ровно цифры из теста 1 на экране.
- [ ] Production-ссылка открывается в инкогнито без логина.
- [ ] README: что это · как запустить · где формулы · источники таблиц · ограничения MVP.
- [ ] Нет секретов в репозитории.
