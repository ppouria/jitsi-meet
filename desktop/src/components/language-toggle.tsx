import { Button } from "@/components/ui/button";
import type { Language } from "@/lib/i18n";

type LanguageToggleProps = {
  label: string;
  language: Language;
  onToggle: () => void;
};

export function LanguageToggle({ label, language, onToggle }: LanguageToggleProps) {
  return (
    <Button
      aria-label={label}
      className="min-w-10 px-2 font-medium"
      onClick={onToggle}
      size="sm"
      title={label}
      type="button"
      variant="ghost"
    >
      {language === "fa" ? "EN" : "FA"}
    </Button>
  );
}
