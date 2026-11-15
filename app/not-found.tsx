import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Page not found — CliffGuard" };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="wrap flex flex-col items-start gap-5 py-20 sm:py-28">
          <p className="eyebrow">404</p>
          <h1 className="text-[34px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-5xl">This page fell off the cliff.</h1>
          <p className="max-w-[52ch] text-lg leading-relaxed text-ink-2">
            The link may be old or mistyped. Your numbers are safe: nothing is stored.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/diagnosis?demo=1" className="btn btn-primary">
              Try demo family
            </Link>
            <Link href="/" className="btn btn-secondary">
              Back to home
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
