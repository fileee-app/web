import { shareInput } from "@fileee/api/schemas";
import { Badge } from "@fileee/ui/components/badge";
import { Button } from "@fileee/ui/components/button";
import { FieldGroup, Field, FieldLabel, FieldError } from "@fileee/ui/components/field";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@fileee/ui/components/item";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@fileee/ui/components/select";
import { Separator } from "@fileee/ui/components/separator";
import { useForm } from "@tanstack/react-form";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { isInvalid, TextField, SubmitButton } from "../../components/form-fields.tsx";
import { formatDate } from "../../lib/format.ts";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { client, orpc } from "../../lib/orpc.ts";
import { CopyField } from "./copy-field.tsx";

const EXPIRIES = [
  { value: "never", label: "Never" },
  { value: "1h", label: "In 1 hour" },
  { value: "1d", label: "In 1 day" },
  { value: "7d", label: "In 7 days" },
  { value: "30d", label: "In 30 days" },
] as const;

type Link = Awaited<ReturnType<typeof client.share.list>>[number];

function stateOf(link: Link) {
  if (link.revokedAt) return "Revoked";
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) return "Expired";

  return null;
}

export function ShareBody({ item }: { item: BrowserItem }) {
  const target = item.kind === "file" ? { fileId: item.id } : { folderId: item.id };
  const queryClient = useQueryClient();
  // Trashing revokes links elsewhere, so always ask again when the dialog opens.
  const links = useQuery(orpc.share.list.queryOptions({ input: target, staleTime: 0 }));
  const [url, setUrl] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.share.key() });

  const create = useMutation(
    orpc.share.create.mutationOptions({
      onSuccess: (link) => {
        setUrl(link.url);

        return refresh();
      },
    }),
  );

  const revoke = useMutation(orpc.share.revoke.mutationOptions({ onSuccess: refresh }));

  const form = useForm({
    defaultValues: { expiry: "never", password: "" } as ReturnType<typeof shareInput.parse>,
    validators: { onChange: shareInput },
    onSubmit: async ({ value, formApi }) => {
      await create.mutateAsync({ ...target, ...value }).then(
        () => formApi.reset(),
        () => {},
      );
    },
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {url && (
        <CopyField
          url={url}
          label="Your new link"
          note="Copy it now. Only a hash is kept, so it can't be shown again."
        />
      )}

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <form.Field name="expiry">
            {(field) => (
              <Field data-invalid={isInvalid(field)}>
                <FieldLabel htmlFor={field.name}>Expires</FieldLabel>

                <Select
                  name={field.name}
                  items={EXPIRIES}
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value as typeof field.state.value)}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {EXPIRIES.map((expiry) => (
                      <SelectItem key={expiry.value} value={expiry.value}>
                        {expiry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {isInvalid(field) && <FieldError errors={field.state.meta.errors} />}
              </Field>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <TextField
                field={field}
                label="Password (optional)"
                type="password"
                autoComplete="new-password"
              />
            )}
          </form.Field>
        </FieldGroup>

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(pending) => (
            <SubmitButton pending={pending} className="self-end">
              Create link
            </SubmitButton>
          )}
        </form.Subscribe>
      </form>

      {links.data && links.data.length > 0 && (
        <>
          <Separator />

          <ItemGroup className="max-h-56 gap-2 overflow-y-auto">
            {links.data.map((link) => {
              const state = stateOf(link);

              return (
                <Item key={link.id} size="xs" variant="outline">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="font-normal">
                      Created {formatDate(link.createdAt)}
                      {state && <Badge variant="secondary">{state}</Badge>}
                      {link.hasPassword && <Badge variant="outline">Password</Badge>}
                    </ItemTitle>

                    <ItemDescription>
                      {link.downloadCount} download{link.downloadCount === 1 ? "" : "s"}
                      {!state && link.expiresAt && ` · expires ${formatDate(link.expiresAt)}`}
                    </ItemDescription>
                  </ItemContent>

                  {!state && (
                    <ItemActions>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate({ linkId: link.id })}
                      >
                        Revoke
                      </Button>
                    </ItemActions>
                  )}
                </Item>
              );
            })}
          </ItemGroup>
        </>
      )}

      <p className="text-sm text-muted-foreground">
        Revoking or expiring a link stops new visits right away, but a download URL already issued
        keeps working until it expires, up to 15 minutes later. Moving this to trash revokes its
        links, and restoring it doesn't bring them back.
      </p>
    </div>
  );
}
