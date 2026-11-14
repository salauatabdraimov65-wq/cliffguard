import type { Metadata } from "next";
import Link from "next/link";
import { Diagnosis } from "@/components/Diagnosis";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { isDemo, queryToInput } from "@/components/inputParams";

export const metadata: Metadata = { title: "Your diagnosis — CliffGuard" };

export default async function DiagnosisPage({ searchParams }: PageProps<"/diagnosis">) {
  const query = await searchParams;
  const input = queryToInput(query);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {input ? (
          <Diagnosis input={input} demo={isDemo(query)} />
        ) : (
          <div className="wrap flex flex-col items-start gap-4 py-24">
            <p className="eyebrow">No household yet</p>
            <h1 className="text-3xl font-semibold tracking-[-0.02em]">Answer five questions first</h1>
            <p className="max-w-[52ch] text-ink-2">
              We need your state, household, income and plan price to estimate your subsidy. Or look at
              a ready-made family.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/quiz" className="btn btn-primary">
                Start the 60-second check
              </Link>
              <Link href="/diagnosis?demo=1" className="btn btn-secondary">
                Try demo family
              </Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
