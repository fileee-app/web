import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@fileee/ui/components/empty";
import { CircleCheckIcon } from "lucide-react";

export function NothingMissing() {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleCheckIcon />
        </EmptyMedia>

        <EmptyTitle>Nothing is missing</EmptyTitle>

        <EmptyDescription>
          Every file fileee knows about was found in the last sync.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
