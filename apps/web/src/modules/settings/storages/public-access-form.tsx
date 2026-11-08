import { publicAccessInput } from "@fileee/api/schemas";
import { Alert, AlertTitle, AlertDescription } from "@fileee/ui/components/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@fileee/ui/components/alert-dialog";
import { Button } from "@fileee/ui/components/button";
import { FieldGroup } from "@fileee/ui/components/field";
import { useForm } from "@tanstack/react-form";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { TriangleAlertIcon, CheckCircle2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DateText } from "../../../components/date-text.tsx";
import { TextField, SubmitButton } from "../../../components/form-fields.tsx";
import { client, orpc } from "../../../lib/orpc.ts";
import { PublicAccessGuide } from "./public-access-guide.tsx";

type Storage = Awaited<ReturnType<typeof client.storage.list>>[number];

export function PublicAccessForm({ storage, onDone }: { storage: Storage; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [confirmingOff, setConfirmingOff] = useState(false);

  const summary = useQuery(
    orpc.storage.publicSummary.queryOptions({ input: { storageId: storage.id }, staleTime: 0 }),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.storage.key() });
  const save = useMutation(orpc.storage.setPublicAccess.mutationOptions({ onSuccess: refresh }));
  const live = summary.data?.live ?? 0;

  const form = useForm({
    defaultValues: {
      cdnBaseUrl: storage.cdnBaseUrl ?? "",
      publicBucket: storage.publicBucket ?? "",
      publicPrefix: storage.publicPrefix ?? "",
    },
    validators: { onChange: publicAccessInput },
    onSubmit: async ({ value }) => {
      if (!value.cdnBaseUrl) return;

      await save.mutateAsync({ ...value, storageId: storage.id }).then(
        () => {
          toast.success("Safety check passed. Public access is on.");
          onDone();
        },
        () => {},
      );
    },
  });

  const turnOff = () =>
    save.mutate(
      { storageId: storage.id, cdnBaseUrl: "", publicBucket: "", publicPrefix: "" },
      {
        onSuccess: () => {
          toast.success("Public access is off.");
          onDone();
        },
      },
    );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PublicAccessGuide provider={storage.provider} />

      {storage.publicCheckError && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>The safety check is failing, so publishing is blocked</AlertTitle>
          <AlertDescription className="break-words">{storage.publicCheckError}</AlertDescription>
        </Alert>
      )}

      {storage.cdnBaseUrl && !storage.publicCheckError && storage.publicCheckedAt && (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Public access is on</AlertTitle>

          <AlertDescription>
            <p>
              Safety check passed <DateText date={storage.publicCheckedAt} />. {live} file
              {live === 1 ? "" : "s"} published.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {summary.data && summary.data.outOfDate.length > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Public copies that are out of date</AlertTitle>

          <AlertDescription className="break-words">
            <p>
              These files have changed since publishing:{" "}
              {summary.data.outOfDate.map((f) => f.name).join(", ")}. Open Share on a file to
              republish it.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup className="gap-4">
          <form.Field
            name="cdnBaseUrl"
            validators={{
              onChange: ({ value }) => (value.trim() ? undefined : "Enter the CDN's URL."),
            }}
          >
            {(field) => (
              <TextField
                field={field}
                label="CDN base URL"
                placeholder="https://cdn.example.com"
                description="Must be on a different host from this app."
                autoComplete="off"
              />
            )}
          </form.Field>

          <form.Field name="publicBucket">
            {(field) => (
              <TextField
                field={field}
                label="Separate public bucket (optional)"
                placeholder={`Blank uses ${storage.bucket}`}
                description="Reached with this storage's credentials. It must be empty, or use a prefix that is."
                autoComplete="off"
              />
            )}
          </form.Field>

          <form.Field name="publicPrefix">
            {(field) => (
              <TextField
                field={field}
                label="Public prefix (optional)"
                placeholder={`${storage.prefix ? `${storage.prefix}/` : ""}.fileee/public`}
                description="From the bucket's root. Blank uses the path shown here, or the root of a separate bucket."
                autoComplete="off"
              />
            )}
          </form.Field>
        </FieldGroup>

        {save.error && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Public access wasn't changed</AlertTitle>
            <AlertDescription className="break-words">{save.error.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          {storage.cdnBaseUrl && (
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => setConfirmingOff(true)}
            >
              Turn off
            </Button>
          )}

          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(pending) => (
              <SubmitButton pending={pending}>
                {storage.cdnBaseUrl ? "Save and check again" : "Check and turn on"}
              </SubmitButton>
            )}
          </form.Subscribe>
        </div>
      </form>

      <AlertDialog open={confirmingOff} onOpenChange={setConfirmingOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off public access?</AlertDialogTitle>

            <AlertDialogDescription>
              This deletes the public {live === 1 ? "copy" : "copies"} of {live} file
              {live === 1 ? "" : "s"}, and their links stop working once the CDN's cache expires.
              Your private files aren't touched.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction variant="destructive" onClick={turnOff}>
              Turn off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
