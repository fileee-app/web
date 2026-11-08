import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@fileee/ui/components/empty";
import { UploadIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyFolder({ children }: { children: ReactNode }) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UploadIcon />
        </EmptyMedia>

        <EmptyTitle>Nothing here yet</EmptyTitle>

        <EmptyDescription>
          Drop files or folders anywhere on this page, or choose them.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>{children}</EmptyContent>
    </Empty>
  );
}
