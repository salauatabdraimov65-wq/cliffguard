import type { Metadata } from "next";
import { Quiz } from "@/components/Quiz";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "60-second check — CliffGuard" };

export default function QuizPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="flex-1">
        <Quiz />
      </main>
    </>
  );
}
