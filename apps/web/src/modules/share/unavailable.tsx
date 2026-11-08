import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@fileee/ui/components/empty";
import { LinkIcon } from "lucide-react";

export function Unavailable() {
  return (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LinkIcon />
        </EmptyMedia>

        <EmptyTitle>This link isn't available</EmptyTitle>

        <EmptyDescription>
          It may have expired or been turned off. Ask the person who sent it for a new one.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
