import { changePasswordInput } from "@fileee/api/schemas";
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
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import * as z from "zod";
import { TextField, SubmitButton } from "../../../components/form-fields.tsx";
import { orpc } from "../../../lib/orpc.ts";

const passwordForm = changePasswordInput
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match.",
  });

export function PasswordCard() {
  const changePassword = useMutation(
    orpc.auth.changePassword.mutationOptions({
      onSuccess: () => {
        passwords.reset();
        toast.success("Password changed. Other devices were signed out.");
      },
    }),
  );

  const passwords = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    validators: { onChange: passwordForm },
    onSubmit: async ({ value }) => {
      await changePassword.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Changing it signs out your other devices.</CardDescription>
      </CardHeader>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void passwords.handleSubmit();
        }}
      >
        <CardContent>
          <FieldGroup>
            <passwords.Field name="currentPassword">
              {(field) => (
                <TextField
                  field={field}
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                />
              )}
            </passwords.Field>

            <passwords.Field name="newPassword">
              {(field) => (
                <TextField
                  field={field}
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  description="At least 12 characters."
                />
              )}
            </passwords.Field>

            <passwords.Field name="confirmPassword">
              {(field) => (
                <TextField
                  field={field}
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                />
              )}
            </passwords.Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className="mt-6">
          <passwords.Subscribe selector={(s) => s.isSubmitting}>
            {(pending) => <SubmitButton pending={pending}>Change password</SubmitButton>}
          </passwords.Subscribe>
        </CardFooter>
      </form>
    </Card>
  );
}
