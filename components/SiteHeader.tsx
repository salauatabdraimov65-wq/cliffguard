import Link from "next/link";
import { LogoMark } from "./Icons";

export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="gutter border-b border-line bg-bg/90 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-ink" aria-label="CliffGuard home">
          <LogoMark className="text-safe" />
          <span className="font-display text-lg font-semibold tracking-tight">CliffGuard</span>
        </Link>
        {!minimal && (
          <nav aria-label="Main" className="flex items-center gap-1 text-sm">
            <Link
              href="/#how"
              className="hidden rounded-lg px-3 py-2 text-muted hover:text-ink sm:inline-block"
            >
              How it works
            </Link>
            <Link
              href="/#pricing"
              className="hidden rounded-lg px-3 py-2 text-muted hover:text-ink sm:inline-block"
            >
              Pricing
            </Link>
            <Link
              href="/diagnosis?demo=1"
              className="ml-1 inline-flex min-h-11 items-center rounded-full border border-ink px-4 font-medium text-ink hover:bg-ink hover:text-bg"
            >
              Try demo family
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
