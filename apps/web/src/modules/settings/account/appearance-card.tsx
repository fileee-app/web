import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@fileee/ui/components/card";
import { FieldGroup, FieldLegend, FieldSet } from "@fileee/ui/components/field";
import { ToggleGroup, ToggleGroupItem } from "@fileee/ui/components/toggle-group";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ACCENTS, type Accent, type Mode, setTheme, useTheme } from "../../../lib/theme.ts";

const MODE_ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

export function AppearanceCard() {
  const { mode, accent } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Saved in this browser.</CardDescription>
      </CardHeader>

      <CardContent>
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">Theme</FieldLegend>

            <ToggleGroup
              value={[mode]}
              onValueChange={(v) => v[0] && setTheme({ mode: v[0] as Mode })}
              variant="outline"
            >
              {(Object.keys(MODE_ICONS) as Mode[]).map((m) => {
                const Icon = MODE_ICONS[m];

                return (
                  <ToggleGroupItem key={m} value={m} className="capitalize">
                    <Icon />
                    {m}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Accent colour</FieldLegend>

            <ToggleGroup
              value={[accent]}
              onValueChange={(v) => v[0] && setTheme({ accent: v[0] as Accent })}
              variant="outline"
              className="flex-wrap"
            >
              {(Object.entries(ACCENTS) as [Accent, string][]).map(([name, color]) => (
                <ToggleGroupItem key={name} value={name} className="capitalize">
                  <span className="size-3 rounded-full" style={{ background: color }} />
                  {name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
