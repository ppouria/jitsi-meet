import { HardDrive, Laptop, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { JoinForm } from "@/components/join-form";
import { LanguageToggle } from "@/components/language-toggle";
import { RecentMeetings } from "@/components/recent-meetings";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  detectLanguage,
  saveLanguage,
  translate,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";
import { normalizeMeetLink, type MeetLinkError } from "@/lib/meet-link";
import { isMac } from "@/lib/platform";
import { addRecent, clearRecent, loadRecent, removeRecent } from "@/lib/recent";
import { applyTheme, detectTheme, saveTheme, type Theme } from "@/lib/theme";

const ERROR_KEYS: Record<MeetLinkError, TranslationKey> = {
  empty: "errorEmpty",
  invalid: "errorInvalid",
  scheme: "errorScheme",
  credentials: "errorCredentials",
};

export default function App() {
  const [language, setLanguage] = useState<Language>(detectLanguage);
  const [theme, setTheme] = useState<Theme>(detectTheme);
  const [value, setValue] = useState("");
  const [error, setError] = useState<TranslationKey | null>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRtl = language === "fa";
  const t = (key: TranslationKey) => translate(language, key);

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = language;
    saveLanguage(language);
  }, [isRtl, language]);

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    return () => cancelAnimationFrame(frame);
  }, []);

  function handleChange(nextValue: string) {
    setValue(nextValue);

    if (error) {
      setError(null);
    }
  }

  function handleSubmit() {
    const result = normalizeMeetLink(value);

    if (!result.ok) {
      setError(ERROR_KEYS[result.reason]);

      return;
    }

    setRecent(addRecent(result.url));
    window.location.assign(result.url);
  }

  function handleOpen(href: string) {
    setRecent(addRecent(href));
    window.location.assign(href);
  }

  function handleRemove(href: string) {
    setRecent(removeRecent(href));
  }

  function handleClear() {
    if (window.confirm(t("clearConfirm"))) {
      clearRecent();
      setRecent([]);
    }
  }

  function handleToggleLanguage() {
    setLanguage(current => (current === "fa" ? "en" : "fa"));
  }

  function handleToggleTheme() {
    setTheme(current => (current === "dark" ? "light" : "dark"));
  }

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-e bg-muted/40 p-10 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:22px_22px]"
        />
        <div className="relative flex items-center gap-2.5">
          <BrandMark className="size-9" />
          <span className="text-sm font-semibold">{t("appName")}</span>
        </div>
        <div className="relative max-w-sm">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            {t("heroTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-pretty text-muted-foreground">
            {t("heroBody")}
          </p>
        </div>
        <ul className="relative flex flex-col gap-2.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0" />
            {t("pointNoDefault")}
          </li>
          <li className="flex items-center gap-2">
            <HardDrive className="size-4 shrink-0" />
            {t("pointLocal")}
          </li>
          <li className="flex items-center gap-2">
            <Laptop className="size-4 shrink-0" />
            {t("pointCrossPlatform")}
          </li>
        </ul>
      </aside>

      <main className="flex flex-col p-6 md:p-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:invisible">
            <BrandMark />
            <span className="text-sm font-semibold">{t("appName")}</span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle
              label={t("language")}
              language={language}
              onToggle={handleToggleLanguage}
            />
            <ThemeToggle label={t("theme")} onToggle={handleToggleTheme} theme={theme} />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
              <p className="mt-2 text-sm leading-6 text-pretty text-muted-foreground">
                {t("subtitle")}
              </p>
            </div>

            <JoinForm
              error={error ? t(error) : null}
              inputRef={inputRef}
              onChange={handleChange}
              onSubmit={handleSubmit}
              t={t}
              value={value}
            />

            <RecentMeetings
              isRtl={isRtl}
              items={recent}
              onClear={handleClear}
              onOpen={handleOpen}
              onRemove={handleRemove}
              t={t}
            />
          </div>
        </div>

        <footer className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{t("footer")}</span>
          <span className="flex items-center gap-1.5">
            <span>{t("shortcutPrefix")}</span>
            <span className="inline-flex items-center gap-1" dir="ltr">
              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                {isMac ? "⌘" : "Ctrl"}
              </kbd>
              <span aria-hidden="true">+</span>
              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                Shift
              </kbd>
              <span aria-hidden="true">+</span>
              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                L
              </kbd>
            </span>
          </span>
        </footer>
      </main>
    </div>
  );
}
