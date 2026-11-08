import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@fileee/ui/components/empty";
import { Trash2Icon } from "lucide-react";

export function TrashEmpty() {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Trash2Icon />
        </EmptyMedia>

        <EmptyTitle>Trash is empty</EmptyTitle>

        <EmptyDescription>
          Files stay in your bucket until you delete them from here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
