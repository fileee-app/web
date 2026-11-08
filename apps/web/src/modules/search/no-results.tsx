import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@fileee/ui/components/empty";
import { SearchXIcon } from "lucide-react";

export function NoResults() {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>

        <EmptyTitle>No files found</EmptyTitle>
        <EmptyDescription>Try other words, or fewer filters.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
