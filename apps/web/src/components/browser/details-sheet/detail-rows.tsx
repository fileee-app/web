import {
  ItemGroup,
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@fileee/ui/components/item";

export function DetailRows({ rows }: { rows: [string, string][] }) {
  return (
    <ItemGroup className="px-4">
      {rows.map(([label, value]) => (
        <Item key={label} size="xs" className="px-0">
          <ItemContent>
            <ItemDescription>{label}</ItemDescription>
            <ItemTitle className="font-normal break-all">{value}</ItemTitle>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
