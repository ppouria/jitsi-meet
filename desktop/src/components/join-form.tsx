import { Link2 } from "lucide-react";
import type { FormEvent, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TranslationKey } from "@/lib/i18n";

type JoinFormProps = {
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onSubmit: () => void;
  t: (key: TranslationKey) => string;
  value: string;
};

export function JoinForm({ error, inputRef, onChange, onSubmit, t, value }: JoinFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="meeting-link">{t("label")}</FieldLabel>
          <div className="relative">
            <Link2
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-describedby={error ? "meeting-link-error" : undefined}
              aria-invalid={error ? true : undefined}
              autoCapitalize="off"
              autoComplete="off"
              className="h-10 pl-9 text-left"
              dir="ltr"
              id="meeting-link"
              inputMode="url"
              onChange={event => onChange(event.target.value)}
              placeholder={t("placeholder")}
              ref={inputRef}
              spellCheck={false}
              type="text"
              value={value}
            />
          </div>
          <FieldError
            errors={error ? [{ message: error }] : undefined}
            id="meeting-link-error"
          />
        </Field>
        <Button className="h-10 w-full" size="lg" type="submit">
          {t("join")}
        </Button>
      </FieldGroup>
    </form>
  );
}
