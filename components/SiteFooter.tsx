import { LogoMark } from "./Icons";

export function SiteFooter() {
  return (
    <footer className="gutter mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 py-10 text-sm text-muted-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2 text-ink">
          <LogoMark className="text-safe" width={20} height={20} />
          <span className="font-display font-semibold">CliffGuard</span>
        </div>
        <p className="max-w-2xl leading-relaxed">
          We never sell insurance and never move your money. CliffGuard provides educational
          estimates based on published IRS and HHS tables. It is not tax, legal or insurance
          advice.
        </p>
      </div>
    </footer>
  );
}
