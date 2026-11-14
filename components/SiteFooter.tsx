import { Logo } from "./SiteHeader";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="wrap grid gap-8 py-12 md:grid-cols-[1fr_2fr] md:gap-16">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-sm text-ink-3">Built for the 2027 coverage year.</p>
        </div>
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-ink-2">
          <p className="max-w-[62ch]">
            We never sell insurance and never move your money. CliffGuard provides educational
            estimates based on published IRS and HHS tables. It is not tax, legal or insurance
            advice.
          </p>
          <p className="max-w-[62ch] text-ink-3">
            Sources: IRS Rev. Proc. 2026-26 (applicable percentages), HHS 2026 poverty guidelines,
            IRS Notice 2026-5, KFF (Oct 30, 2026). Alaska and Hawaii are not supported yet.
          </p>
        </div>
      </div>
    </footer>
  );
}
