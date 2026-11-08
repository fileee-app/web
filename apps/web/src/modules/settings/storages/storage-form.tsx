import { PROVIDERS, storageInput, storageUpdateInput, type Provider } from "@fileee/api/schemas";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@fileee/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@fileee/ui/components/select";
import { Switch } from "@fileee/ui/components/switch";
import { useForm } from "@tanstack/react-form";
import type { ReactNode } from "react";
import { SubmitButton, TextField, isInvalid } from "../../../components/form-fields.tsx";

const PROVIDER_ITEMS = Object.entries(PROVIDERS).map(([value, { label }]) => ({ value, label }));

export interface StorageValues {
  name: string;
  provider: Provider;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
}

export const EMPTY_STORAGE: StorageValues = {
  name: "",
  provider: "s3",
  endpoint: "",
  region: PROVIDERS.s3.region,
  bucket: "",
  prefix: "",
  forcePathStyle: false,
  accessKeyId: "",
  secretAccessKey: "",
};

export function StorageForm({
  initial,
  editing,
  submitLabel,
  footer,
  onSubmit,
}: {
  initial: StorageValues;
  /** When editing, blank credentials keep the stored ones. A null hint means they can't be read and must be entered again. */
  editing?: { accessKeyHint: string | null };
  submitLabel: string;
  footer?: ReactNode;
  onSubmit: (values: StorageValues) => Promise<unknown>;
}) {
  const form = useForm({
    defaultValues: initial,
    validators: { onChange: editing ? storageUpdateInput : storageInput },
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field
          name="provider"
          listeners={{
            onChange: ({ value, fieldApi }) => {
              const preset = PROVIDERS[value];

              // Templates like https://<account>... only make sense as placeholders.
              fieldApi.form.setFieldValue(
                "endpoint",
                preset.endpoint.includes("<") ? "" : preset.endpoint,
              );

              fieldApi.form.setFieldValue("region", preset.region);
              fieldApi.form.setFieldValue("forcePathStyle", preset.forcePathStyle);
            },
          }}
        >
          {(field) => (
            <Field data-invalid={isInvalid(field)}>
              <FieldLabel htmlFor={field.name}>Provider</FieldLabel>

              <Select
                name={field.name}
                items={PROVIDER_ITEMS}
                value={field.state.value}
                onValueChange={(value) => field.handleChange(value as Provider)}
              >
                <SelectTrigger id={field.name} className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {PROVIDER_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isInvalid(field) && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )}
        </form.Field>

        <form.Field name="name">
          {(field) => (
            <TextField field={field} label="Name" placeholder="Work files" autoComplete="off" />
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.values.provider}>
          {(provider) =>
            provider !== "s3" && (
              <form.Field name="endpoint">
                {(field) => (
                  <TextField
                    field={field}
                    label="Endpoint"
                    placeholder={PROVIDERS[provider].endpoint || "https://s3.example.com"}
                    autoComplete="off"
                    spellCheck={false}
                  />
                )}
              </form.Field>
            )
          }
        </form.Subscribe>

        <div className="grid gap-6 sm:grid-cols-2">
          <form.Field name="bucket">
            {(field) => (
              <TextField field={field} label="Bucket" autoComplete="off" spellCheck={false} />
            )}
          </form.Field>

          <form.Field name="region">
            {(field) => (
              <TextField field={field} label="Region" autoComplete="off" spellCheck={false} />
            )}
          </form.Field>
        </div>

        <form.Field name="prefix">
          {(field) => (
            <TextField
              field={field}
              label="Prefix"
              placeholder="fileee/"
              autoComplete="off"
              spellCheck={false}
              description="Optional. fileee only touches objects under this path."
            />
          )}
        </form.Field>

        <form.Field name="accessKeyId">
          {(field) => (
            <TextField
              field={field}
              label="Access key ID"
              autoComplete="off"
              spellCheck={false}
              placeholder={
                editing?.accessKeyHint ? `Current key ends in ${editing.accessKeyHint}` : undefined
              }
              description={
                !editing
                  ? "Use a credential scoped to this one bucket."
                  : editing.accessKeyHint
                    ? "Leave blank to keep the current key."
                    : "The saved key can't be read. Enter it again."
              }
            />
          )}
        </form.Field>

        <form.Field name="secretAccessKey">
          {(field) => (
            <TextField
              field={field}
              label="Secret access key"
              type="password"
              // browsers ignore "off" on password fields and fill in the saved app login
              autoComplete="new-password"
              placeholder={editing?.accessKeyHint ? "••••••••" : undefined}
              description={
                !editing
                  ? "Encrypted before it's stored, and never shown again."
                  : editing.accessKeyHint
                    ? "Leave blank to keep the current secret."
                    : "The saved secret can't be read. Enter it again."
              }
            />
          )}
        </form.Field>

        <form.Field name="forcePathStyle">
          {(field) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Path-style URLs</FieldLabel>
                <FieldDescription>Needed by MinIO and some self-hosted servers.</FieldDescription>
              </FieldContent>

              <Switch
                id={field.name}
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked)}
              />
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        {footer}

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(pending) => <SubmitButton pending={pending}>{submitLabel}</SubmitButton>}
        </form.Subscribe>
      </div>
    </form>
  );
}
