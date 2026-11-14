# CliffGuard — FRONTEND (экраны и логика интерфейса)

> Сначала прочитай `PROJECT.md`. Здесь — только задачи фронтенда: какие экраны есть, что на них и как они работают.
> Цель: жюри за 10 секунд понимает боль и за 30 секунд видит «вау-момент» — обрыв на графике.
> Визуальный стиль (цвета, шрифты, отступы, анимации, внешний вид компонентов) в этом файле не задаётся — его определяют дизайн-скиллы.

---

## 0. Главное правило параллельной работы

До 04:00 **не жди бэкенд**. Работай на `src/lib/fakeCalc.ts`, который возвращает тот же тип `Result`, что и настоящий движок:

```ts
// src/lib/fakeCalc.ts — временная заглушка; в 04:00 заменяется на engine.calculate
import type { Input, Result } from "./types";
export function fakeCalc(input: Input): Result {
  const fpl = 15960 + 5680 * (input.householdSize - 1);
  const cliff = 4 * fpl;
  const sub = (m: number) => (m <= cliff ? Math.max(0, input.benchmarkPremium - 0.1022 * m) : 0);
  const magi = input.income;
  const overBy = Math.max(0, magi - cliff);
  const need = overBy > 0 ? Math.ceil((overBy + 500) / 500) * 500 : 0;
  const after = magi - need;
  return { fpl, cliff, magi, fplPercent: magi / fpl, subsidy: Math.round(sub(magi)), overBy,
    loss: overBy > 0 ? Math.round(sub(cliff)) : 0, plan: [], feasible: true, contributionNeeded: need,
    magiAfterPlan: after, subsidyAfterPlan: Math.round(sub(after)), estTaxSavings: Math.round(need * 0.22),
    netBenefit: Math.round(sub(after) - sub(magi) + need * 0.22), warnings: [] };
}
```

Все компоненты получают данные **только через** `Result` — тогда замена на настоящий движок занимает 5 минут.

## 1. Экраны и приоритеты

| # | Страница | Что на ней | Приоритет | Дедлайн |
|---|---|---|---|---|
| 1 | `/` Landing | Хук, 2 CTA, 3 шага, «Why now», pricing, дисклеймер | P0 | 01:30 |
| 2 | `/diagnosis` | **График обрыва + ползунок дохода + кнопка «Apply rescue plan»** | **P0 (самое важное)** | 03:30 |
| 3 | `/quiz` | 5 шагов, по одному вопросу на экран, прогресс-бар | P0 | 03:00 |
| 4 | `/plan` | Шаги плана, 1-й открыт, остальные blur + PRO, карточка $149/год (+ гарантия возврата) | P0 | 06:00 |
| 5 | `/monitor` | «Room under the cliff», помесячный доход, напоминания | P1 | 07:30 |
| 6 | Мобильная версия всех экранов | P0 | 07:30 |

«Try demo family» → `/diagnosis?demo=1` — подставляет `demoFamily` без квиза и логина.

## 2. Экран Diagnosis — функциональная спецификация (вау-момент)

- **Баннер сверху** — два состояния, которые пользователь должен сразу различать:
  - выше обрыва: `You're $4,000 over the subsidy cliff` / `You're losing $10,510 a year` + кнопка `Apply rescue plan: $4,500 → SEP IRA`
  - ниже обрыва: `You are $X under the cliff` / `You keep $Y a year`; после применения плана — `Plan applied — you are back under the cliff` + `Undo plan`
- **График:** субсидия по доходу от $110k до $154k с шагом $2k (23 точки данных). Значение = `subsidyFor(x)`. Точка пользователя выделена. Граница обрыва подписана `$132k cliff`. Переход через обрыв на графике должен быть наглядным — как именно, решает дизайн.
- **Ползунок:** `<input type="range" min=110000 max=154000 step=500>` + `<label>`; меняет `income`, всё пересчитывается мгновенно.
- **Блок «The math»:** Income · Retirement contribution · MAGI · Cliff · Your subsidy.
- Сноска: `Estimate for illustration using IRS Rev. Proc. 2026-26 and 2026 poverty guidelines. Not tax advice.`

## 3. Тексты (EN, использовать дословно)

- **Hero:** `Earn $1 more. Lose $10,500.`
- **Sub:** `If you're self-employed and buy health insurance on the ACA Marketplace, crossing the subsidy cliff wipes out your entire premium tax credit. CliffGuard shows what you're losing and the legal way to get it back.`
- **CTA:** `See what I'm losing — 60 sec` · `Try demo family`
- **Badge:** `2027 open enrollment is live · ends Jan 15`
- **Why now (3 пункта):** `+13% benchmark premiums for 2027` · `The 400% FPL cutoff is back since Jan 1, 2026` · `No cap on paying back excess subsidy, starting with 2026 taxes`
- **Footer:** `We never sell insurance and never move your money. CliffGuard provides educational estimates based on published IRS and HHS tables. It is not tax, legal or insurance advice.`

## 4. Квиз (5 шагов)

1. `What's your ZIP code?` → штат (AK/HI → сообщение «not supported yet»).
2. `Who's on your plan?` — число людей + возраст каждого.
3. `What will your household earn in 2027?` — сумма + `How steady is it?` (3 радио) + опц. `Upload invoices or a bank CSV`.
4. `How do you earn?` — Freelance/1099 · Own business · Mix of W-2 and self-employment.
5. `What does your benchmark silver plan cost?` — сумма/мес + ссылка-подсказка на healthcare.gov «See plans & prices»; кнопка `I don't know — use the average`.

Состояние квиза — в React state/URL; на выходе собрать `Input` и перейти на `/diagnosis`.

## 5. Доступность и качество

- Настоящие `<button>`, `<a>`, `<input>` + `<label>`; `aria-label` у иконок-кнопок.
- Работает на ширине 375px: ничего не обрезается, графики видны целиком.
- Никаких лишних запросов; страница диагноза грузится < 1 с.

## 6. Definition of Done

- [ ] Путь Landing → Quiz → Diagnosis → Plan проходится кликами без ошибок.
- [ ] `Try demo family` показывает цифры демо-семьи (см. `PROJECT.md` §6) без логина.
- [ ] Ползунок и `Apply rescue plan` работают на телефоне.
- [ ] Скриншоты 4 экранов (1440px) переданы бизнесу для деки к 07:00.
- [ ] Записано запасное видео демо 60 сек (Landing → demo → ползунок → план) к 10:00.
