import { itemNameSchema } from "@fileee/api/schemas";
import { DialogFooter } from "@fileee/ui/components/dialog";
import { FieldGroup } from "@fileee/ui/components/field";
import { useForm } from "@tanstack/react-form";
import * as z from "zod";
import { TextField, SubmitButton } from "../../components/form-fields.tsx";

const nameForm = z.object({ name: itemNameSchema });

export function NameForm({
  initial,
  label,
  submitLabel,
  onSubmit,
}: {
  initial: string;
  label: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<unknown>;
}) {
  const form = useForm({
    defaultValues: { name: initial },
    validators: { onChange: nameForm },
    onSubmit: ({ value }) => onSubmit(value.name.trim()),
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="name">
          {(field) => <TextField field={field} label={label} autoComplete="off" />}
        </form.Field>
      </FieldGroup>

      <DialogFooter>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(pending) => <SubmitButton pending={pending}>{submitLabel}</SubmitButton>}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
