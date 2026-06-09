"use client";

import { GithubIcon, ShieldIcon } from "@/ui/components/icons";
import { LocaleSwitcher } from "@/ui/components/locale-switcher";
import { Workspace } from "@/ui/components/workspace";
import { useI18n } from "@/i18n/provider";

/** Stable keys into `dict.features`; order drives the on-page card order. */
const FEATURE_KEYS = ["clientSide", "families", "observable"] as const;

export default function HomePage() {
  const { dict } = useI18n();

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-10 sm:px-6">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-foreground">
              ⇄
            </span>
            <span className="text-xl font-semibold tracking-tight">
              open<span className="text-accent">Conv</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <a
              href="https://github.com/mustafakarakulak/openconv"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-900"
            >
              <GithubIcon className="text-base" />
              <span className="hidden sm:inline">{dict.header.github}</span>
            </a>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            {dict.hero.title}
          </h1>
          <p className="max-w-xl text-zinc-400">{dict.hero.description}</p>
          <p className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
            <ShieldIcon className="text-base" />
            {dict.hero.privacy}
          </p>
        </div>
      </header>

      <main className="flex-1">
        <Workspace />
      </main>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {FEATURE_KEYS.map((key) => {
          const feature = dict.features[key];
          return (
            <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-sm font-semibold text-zinc-100">{feature.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{feature.body}</p>
            </div>
          );
        })}
      </section>

      <footer className="mt-12 border-t border-zinc-900 pt-6 text-center text-xs text-zinc-600">
        <p>{dict.footer.text}</p>
      </footer>
    </div>
  );
}
