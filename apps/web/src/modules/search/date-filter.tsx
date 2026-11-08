import { Input } from "@fileee/ui/components/input";
import { Label } from "@fileee/ui/components/label";

export function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Label className="flex flex-col items-start gap-1.5 text-xs font-normal text-muted-foreground">
      {label}

      <Input
        type="date"
        aria-label={label}
        className="w-40 text-foreground"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </Label>
  );
}
