import { ArrowUpRight, Globe2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TranslationKey } from "@/lib/i18n";
import { describeMeetLink } from "@/lib/meet-link";
import { cn } from "@/lib/utils";

type RecentMeetingsProps = {
  isRtl: boolean;
  items: string[];
  onClear: () => void;
  onOpen: (href: string) => void;
  onRemove: (href: string) => void;
  t: (key: TranslationKey) => string;
};

export function RecentMeetings({
  isRtl,
  items,
  onClear,
  onOpen,
  onRemove,
  t,
}: RecentMeetingsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {t("recent")}
        </h2>
        <Button
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={onClear}
          size="xs"
          type="button"
          variant="ghost"
        >
          {t("clear")}
        </Button>
      </div>
      <div className="flex flex-col gap-0.5" role="list">
        {items.map(href => {
          const { host, path } = describeMeetLink(href);

          return (
            <div className="flex items-center gap-0.5" key={href} role="listitem">
              <button
                className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-start transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={() => onOpen(href)}
                title={href}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground"
                >
                  <Globe2 className="size-4" />
                </span>
                <span className="min-w-0 flex-1" dir="ltr">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {host}
                  </span>
                  {path && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {path}
                    </span>
                  )}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground opacity-60",
                    isRtl && "-scale-x-100",
                  )}
                />
              </button>
              <Button
                aria-label={`${t("remove")}: ${href}`}
                className="text-muted-foreground"
                onClick={() => onRemove(href)}
                size="icon-xs"
                title={t("remove")}
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
