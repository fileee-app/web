import { passwordSchema } from "@fileee/api/schemas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@fileee/ui/components/dialog";
import { FieldGroup } from "@fileee/ui/components/field";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import * as z from "zod";
import { TextField, SubmitButton } from "../../../components/form-fields.tsx";
import { orpc } from "../../../lib/orpc.ts";

export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const reset = useMutation(
    orpc.user.resetPassword.mutationOptions({
      onSuccess: () => {
        onClose();
        form.reset();
        toast.success("Password reset. They've been signed out everywhere.");
      },
    }),
  );

  const form = useForm({
    defaultValues: { password: "" },
    validators: { onChange: z.object({ password: passwordSchema }) },
    onSubmit: async ({ value }) => {
      if (user)
        await reset.mutateAsync({ userId: user.id, password: value.password }).catch(() => {});
    },
  });

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>

          <DialogDescription>
            Set a new password for {user?.name}. This signs them out everywhere.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="password">
              {(field) => (
                <TextField
                  field={field}
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                />
              )}
            </form.Field>
          </FieldGroup>

          <DialogFooter>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(pending) => <SubmitButton pending={pending}>Reset password</SubmitButton>}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
