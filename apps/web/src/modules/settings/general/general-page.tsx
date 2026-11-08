import { appNameSchema } from "@fileee/api/schemas";
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
import { toast } from "sonner";
import * as z from "zod";
import { TextField, SubmitButton } from "../../../components/form-fields.tsx";
import { orpc } from "../../../lib/orpc.ts";

const route = getRouteApi("/_app/settings/general");

export function GeneralPage() {
  const { status } = route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();

  const update = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.setup.status.key() });
        await router.invalidate(); // the page title reads the name through the root loader
        toast.success("Settings saved.");
      },
    }),
  );

  const form = useForm({
    defaultValues: { appName: status.appName === "Fileee" ? "" : status.appName },
    validators: { onChange: z.object({ appName: appNameSchema }) },
    onSubmit: async ({ value }) => {
      await update.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>

        <CardDescription>
          Shown in the sidebar, page titles and on the sign-in page.
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
            <form.Field name="appName">
              {(field) => (
                <TextField
                  field={field}
                  label="App name"
                  placeholder="Fileee"
                  description="Public, because the sign-in page shows it."
                />
              )}
            </form.Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className="mt-6">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(pending) => <SubmitButton pending={pending}>Save</SubmitButton>}
          </form.Subscribe>
        </CardFooter>
      </form>
    </Card>
  );
}
