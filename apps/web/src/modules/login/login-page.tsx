import { loginInput } from "@fileee/api/schemas";
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
import { AuthLayout } from "../../components/auth-layout.tsx";
import { TextField, SubmitButton } from "../../components/form-fields.tsx";
import { orpc } from "../../lib/orpc.ts";

const route = getRouteApi("/login");

export function LoginPage() {
  const { status } = route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();

  const login = useMutation(
    orpc.auth.login.mutationOptions({
      onSuccess: async () => {
        queryClient.clear();
        await router.navigate({ to: "/" });
      },
    }),
  );

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onChange: loginInput },
    onSubmit: async ({ value }) => {
      await login.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <AuthLayout appName={status.appName}>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>

          <CardDescription>
            Your admin creates accounts here. There's no public sign-up.
          </CardDescription>
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
                    autoComplete="current-password"
                  />
                )}
              </form.Field>
            </FieldGroup>
          </CardContent>

          <CardFooter className="mt-6">
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(pending) => (
                <SubmitButton pending={pending} className="w-full">
                  Sign in
                </SubmitButton>
              )}
            </form.Subscribe>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
