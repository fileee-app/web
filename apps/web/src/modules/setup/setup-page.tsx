import { setupInput } from "@fileee/api/schemas";
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
import { getRouteApi, useRouter } from "@tanstack/react-router";
import * as z from "zod";
import { AuthLayout } from "../../components/auth-layout.tsx";
import { TextField, SubmitButton } from "../../components/form-fields.tsx";
import { orpc } from "../../lib/orpc.ts";

const route = getRouteApi("/setup");

const schema = setupInput
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match.",
  });

export function SetupPage() {
  const { status } = route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();

  const complete = useMutation(
    orpc.setup.complete.mutationOptions({
      onSuccess: async () => {
        queryClient.clear();
        await router.navigate({ to: "/" });
        await router.invalidate(); // the root loader still holds the pre-setup app name
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      appName: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      setupToken: "",
    },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      await complete.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <AuthLayout appName="Fileee">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set up this instance</CardTitle>
          <CardDescription>Name it and create the first admin account.</CardDescription>
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
              {status.setupTokenRequired && (
                <form.Field name="setupToken">
                  {(field) => (
                    <TextField
                      field={field}
                      label="Setup token"
                      type="password"
                      autoComplete="off"
                      description="The SETUP_TOKEN set on the server."
                    />
                  )}
                </form.Field>
              )}

              <form.Field name="appName">
                {(field) => (
                  <TextField
                    field={field}
                    label="App name"
                    placeholder="Fileee"
                    description="Optional. You can change it later."
                  />
                )}
              </form.Field>

              <form.Field name="name">
                {(field) => <TextField field={field} label="Your name" autoComplete="name" />}
              </form.Field>

              <form.Field name="email">
                {(field) => (
                  <TextField field={field} label="Email" type="email" autoComplete="email" />
                )}
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

              <form.Field name="confirmPassword">
                {(field) => (
                  <TextField
                    field={field}
                    label="Confirm password"
                    type="password"
                    autoComplete="new-password"
                  />
                )}
              </form.Field>
            </FieldGroup>
          </CardContent>

          <CardFooter className="mt-6">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(pending) => (
                <SubmitButton pending={pending} className="w-full">
                  Create admin account
                </SubmitButton>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
