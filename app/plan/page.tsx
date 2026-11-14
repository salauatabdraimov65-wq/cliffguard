import type { Metadata } from "next";
import { PlanView } from "@/components/PlanView";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { isDemo, queryToInput } from "@/components/inputParams";

export const metadata: Metadata = { title: "Your plan — CliffGuard" };

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const query = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <PlanView input={queryToInput(query)} demo={isDemo(query)} paid={query.paid === "1"} canceled={query.canceled === "1"} />
      </main>
      <SiteFooter />
    </>
  );
}
