import { createUserInput } from "@fileee/api/schemas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@fileee/ui/components/dialog";
import { FieldGroup, Field, FieldLabel, FieldError } from "@fileee/ui/components/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@fileee/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { TextField, isInvalid, SubmitButton } from "../../../components/form-fields.tsx";
import { orpc } from "../../../lib/orpc.ts";

const ROLES = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
];

export function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const create = useMutation(
    orpc.user.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.user.key() });
        onOpenChange(false);
        form.reset();
        toast.success("User created. Share the password with them.");
      },
    }),
  );

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", role: "user" as "user" | "admin" },
    validators: { onChange: createUserInput },
    onSubmit: async ({ value }) => {
      await create.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>

          <DialogDescription>
            No email is sent. Share the password with them yourself.
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
            <form.Field name="name">
              {(field) => <TextField field={field} label="Name" autoComplete="off" />}
            </form.Field>

            <form.Field name="email">
              {(field) => <TextField field={field} label="Email" type="email" autoComplete="off" />}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <TextField
                  field={field}
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  description="At least 12 characters."
                />
              )}
            </form.Field>

            <form.Field name="role">
              {(field) => (
                <Field data-invalid={isInvalid(field)}>
                  <FieldLabel htmlFor={field.name}>Role</FieldLabel>

                  <Select
                    name={field.name}
                    items={ROLES}
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as "user" | "admin")}
                  >
                    <SelectTrigger
                      id={field.name}
                      className="w-full"
                      aria-invalid={isInvalid(field)}
                    >
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {isInvalid(field) && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )}
            </form.Field>
          </FieldGroup>

          <DialogFooter>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(pending) => <SubmitButton pending={pending}>Create user</SubmitButton>}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
