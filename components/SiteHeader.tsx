import Link from "next/link";
import { Mark } from "./Icons";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-2.5 text-[17px] font-semibold"
      aria-label="CliffGuard home"
    >
      <Mark inverted={inverted} />
      CliffGuard
    </Link>
  );
}

/** overlay = transparent, light-on-dark, sits on top of the landing hero. */
export function SiteHeader({ minimal = false, overlay = false }: { minimal?: boolean; overlay?: boolean }) {
  const link = overlay
    ? "text-[var(--h-ink-2)] hover:text-[var(--h-ink)]"
    : "text-ink-2 hover:text-ink";
  return (
    <header
      className={
        overlay
          ? "hero absolute inset-x-0 top-0 z-30 !bg-transparent"
          : "sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur-sm supports-[backdrop-filter]:bg-page/80"
      }
    >
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Logo />
        {!minimal && (
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Link href="/#how" className={`hidden min-h-11 items-center rounded-lg px-3 text-[15px] transition-colors md:inline-flex ${link}`}>
              How it works
            </Link>
            <Link href="/#pricing" className={`hidden min-h-11 items-center rounded-lg px-3 text-[15px] transition-colors md:inline-flex ${link}`}>
              Pricing
            </Link>
            <Link
              href="/diagnosis?demo=1"
              className={
                overlay
                  ? "btn btn-sm ml-1 min-h-11 border border-[var(--h-line)] text-[var(--h-ink)] hover:bg-[var(--h-line)] sm:min-h-9"
                  : "btn btn-secondary btn-sm ml-1 min-h-11 sm:min-h-9"
              }
            >
              Try demo family
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
