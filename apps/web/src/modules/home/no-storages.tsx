import { Button } from "@fileee/ui/components/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@fileee/ui/components/empty";
import { Link } from "@tanstack/react-router";
import { DatabaseIcon } from "lucide-react";

export function NoStorages() {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DatabaseIcon />
        </EmptyMedia>

        <EmptyTitle>Connect your first bucket</EmptyTitle>

        <EmptyDescription>
          Your files stay in storage you own: AWS S3, Cloudflare R2, Backblaze B2 and others.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/settings/storages/new" />}>
          Connect storage
        </Button>
      </EmptyContent>
    </Empty>
  );
}
