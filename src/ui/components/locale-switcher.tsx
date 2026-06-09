"use client";

import { LOCALE_NAMES, LOCALES, isLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/cn";
import { GlobeIcon } from "./icons";

/**
 * Language picker. A native <select> for full keyboard/screen-reader support;
 * the chosen locale is persisted and reflected onto <html lang/dir> by the
 * provider. RTL-safe: in Arabic the icon sits on the right via logical spacing.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, dict } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 ps-2.5 pe-1.5 text-sm text-zinc-300 transition-colors focus-within:border-accent hover:bg-zinc-900",
        className,
      )}
    >
      <GlobeIcon className="text-base text-zinc-400" />
      <select
        value={locale}
        aria-label={dict.locale.label}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) setLocale(next);
        }}
        className="cursor-pointer appearance-none bg-transparent py-1.5 pe-1 text-zinc-200 outline-none"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} className="bg-zinc-900 text-zinc-100">
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
