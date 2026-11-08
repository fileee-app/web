import { sharePasswordInput } from "@fileee/api/schemas";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@fileee/ui/components/card";
import { FieldGroup } from "@fileee/ui/components/field";
import { useForm } from "@tanstack/react-form";
import { TextField, SubmitButton } from "../../components/form-fields.tsx";

export function PasswordForm({ onSubmit }: { onSubmit: (password: string) => Promise<unknown> }) {
  const form = useForm({
    defaultValues: { password: "" },
    validators: { onChange: sharePasswordInput },
    onSubmit: ({ value }) => onSubmit(value.password).catch(() => {}),
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Enter the password</CardTitle>
        <CardDescription>This link is protected with a password.</CardDescription>
      </CardHeader>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <CardContent>
          <FieldGroup>
            <form.Field name="password">
              {(field) => (
                <TextField field={field} label="Password" type="password" autoComplete="off" />
              )}
            </form.Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className="mt-6">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(pending) => (
              <SubmitButton pending={pending} className="w-full">
                Continue
              </SubmitButton>
            )}
          </form.Subscribe>
        </CardFooter>
      </form>
    </Card>
  );
}
