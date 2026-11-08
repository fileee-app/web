import { nameSchema } from "@fileee/api/schemas";
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
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import * as z from "zod";
import { TextField, SubmitButton } from "../../../components/form-fields.tsx";
import { orpc } from "../../../lib/orpc.ts";

export function ProfileCard({ user }: { user: { name: string; email: string } }) {
  const queryClient = useQueryClient();

  const updateProfile = useMutation(
    orpc.auth.updateProfile.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.auth.me.key() });
        toast.success("Name updated.");
      },
    }),
  );

  const profile = useForm({
    defaultValues: { name: user.name },
    validators: { onChange: z.object({ name: nameSchema }) },
    onSubmit: async ({ value }) => {
      await updateProfile.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Signed in as {user.email}.</CardDescription>
      </CardHeader>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void profile.handleSubmit();
        }}
      >
        <CardContent>
          <FieldGroup>
            <profile.Field name="name">
              {(field) => <TextField field={field} label="Name" autoComplete="name" />}
            </profile.Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className="mt-6">
          <profile.Subscribe selector={(s) => s.isSubmitting}>
            {(pending) => <SubmitButton pending={pending}>Save</SubmitButton>}
          </profile.Subscribe>
        </CardFooter>
      </form>
    </Card>
  );
}
