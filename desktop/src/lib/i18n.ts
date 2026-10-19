export type Language = "fa" | "en";

const en = {
  appName: "Jitsi Meet",
  title: "Join a meeting",
  subtitle: "Paste a meeting link. Any Jitsi Meet server works, public or self-hosted.",
  label: "Meeting link",
  placeholder: "https://meet.example.com/room-name",
  join: "Join meeting",
  recent: "Recent meetings",
  clear: "Clear",
  clearConfirm: "Remove all recent meetings?",
  remove: "Remove from recent meetings",
  language: "Change language",
  theme: "Toggle theme",
  light: "Light",
  dark: "Dark",
  heroTitle: "Works with any Jitsi server.",
  heroBody: "Use the public server or your own deployment. Nothing is preconfigured.",
  pointNoDefault: "No default server",
  pointLocal: "Recent links stay on this device",
  pointCrossPlatform: "Windows, macOS, and Linux",
  footer: "Not connected to any server.",
  shortcutPrefix: "Return",
  errorEmpty: "Enter a meeting link.",
  errorInvalid: "That doesn't look like a valid link. Example: https://meet.example.com/room",
  errorScheme: "Only http and https links are supported.",
  errorCredentials: "The link must not include a username or password.",
} as const;

export type TranslationKey = keyof typeof en;

const fa: Record<TranslationKey, string> = {
  appName: "Jitsi Meet",
  title: "ورود به جلسه",
  subtitle: "لینک جلسه را وارد کنید؛ هر سرور Jitsi Meet، عمومی یا شخصی، پشتیبانی می‌شود.",
  label: "لینک جلسه",
  placeholder: "https://meet.example.com/room-name",
  join: "ورود به جلسه",
  recent: "جلسات اخیر",
  clear: "پاک کردن",
  clearConfirm: "همهٔ جلسات اخیر حذف شوند؟",
  remove: "حذف از جلسات اخیر",
  language: "تغییر زبان",
  theme: "تغییر پوسته",
  light: "روشن",
  dark: "تاریک",
  heroTitle: "با هر سرور Jitsi کار می‌کند.",
  heroBody: "از سرور عمومی یا سرور خودت استفاده کن. هیچ چیزی از قبل تنظیم نشده است.",
  pointNoDefault: "بدون سرور پیش‌فرض",
  pointLocal: "لینک‌ها فقط روی همین دستگاه می‌مانند",
  pointCrossPlatform: "برای ویندوز، مک و لینوکس",
  footer: "به هیچ سروری وصل نیست.",
  shortcutPrefix: "بازگشت",
  errorEmpty: "لینک جلسه را وارد کنید.",
  errorInvalid: "این آدرس معتبر نیست. نمونه: https://meet.example.com/room",
  errorScheme: "فقط لینک‌های http و https پشتیبانی می‌شوند.",
  errorCredentials: "لینک نباید شامل نام کاربری یا رمز عبور باشد.",
};

const messages: Record<Language, Record<TranslationKey, string>> = { en, fa };

export function translate(language: Language, key: TranslationKey): string {
  return messages[language][key];
}

const LANGUAGE_KEY = "jitsi-meet-desktop.language";

export function detectLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);

    if (stored === "fa" || stored === "en") {
      return stored;
    }
  } catch {
    // Storage can be unavailable in a locked-down WebView profile.
  }

  return navigator.language.toLowerCase().startsWith("fa") ? "fa" : "en";
}

export function saveLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Ignore storage failures; the launcher still works.
  }
}
