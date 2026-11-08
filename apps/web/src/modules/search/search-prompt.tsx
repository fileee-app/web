import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@fileee/ui/components/empty";
import { SearchIcon } from "lucide-react";

export function SearchPrompt() {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchIcon />
        </EmptyMedia>

        <EmptyTitle>Search all your storages</EmptyTitle>

        <EmptyDescription>
          Find files by name, title, author or camera. The start of a word is enough.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
