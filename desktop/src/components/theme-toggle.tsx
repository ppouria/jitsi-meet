import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/theme";

type ThemeToggleProps = {
  label: string;
  onToggle: () => void;
  theme: Theme;
};

export function ThemeToggle({ label, onToggle, theme }: ThemeToggleProps) {
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <Button
      aria-label={label}
      onClick={onToggle}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
    >
      <Icon />
    </Button>
  );
}
