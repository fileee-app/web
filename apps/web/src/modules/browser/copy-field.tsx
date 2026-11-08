import { Field, FieldLabel } from "@fileee/ui/components/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@fileee/ui/components/input-group";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

export function CopyField({ url, label, note }: { url: string; label: string; note?: string }) {
  const copy = () =>
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied."))
      .catch(() => toast.error("Couldn't copy. Select the link and copy it yourself."));

  return (
    <Field>
      <FieldLabel htmlFor="share-url">{label}</FieldLabel>

      <InputGroup>
        <InputGroupInput
          id="share-url"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="font-mono text-xs"
        />

        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={copy}>
            <CopyIcon />
            Copy
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </Field>
  );
}
