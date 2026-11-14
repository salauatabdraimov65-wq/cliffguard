import type { Metadata } from "next";
import { Monitor } from "@/components/Monitor";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { isDemo, queryToInput } from "@/components/inputParams";
import { demoFamily } from "@/lib/demoFamily";

export const metadata: Metadata = { title: "Room under the cliff — CliffGuard" };

export default async function MonitorPage({ searchParams }: PageProps<"/monitor">) {
  const query = await searchParams;
  const input = queryToInput(query);
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Monitor input={input ?? demoFamily} demo={!input || isDemo(query)} />
      </main>
      <SiteFooter />
    </>
  );
}
