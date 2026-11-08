import { Button } from "@fileee/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@fileee/ui/components/field";
import { Input } from "@fileee/ui/components/input";
import { Spinner } from "@fileee/ui/components/spinner";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ComponentProps, ReactNode } from "react";

/** isTouched turns on at the first change, so with onChange validators errors appear as the user types. */
export const isInvalid = (field: AnyFieldApi) =>
  field.state.meta.isTouched && !field.state.meta.isValid;

/** shadcn's TanStack Form field: Field + FieldLabel + Input + FieldError. */
export function TextField({
  field,
  label,
  description,
  ...props
}: { field: AnyFieldApi; label: ReactNode; description?: ReactNode } & ComponentProps<
  typeof Input
>) {
  const invalid = isInvalid(field);

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>

      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={invalid}
        {...props}
      />

      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

export function SubmitButton({
  pending,
  children,
  ...props
}: { pending: boolean } & ComponentProps<typeof Button>) {
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  );
}
