import { Button } from "@fileee/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@fileee/ui/components/empty";
import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { FileQuestionIcon, TriangleAlertIcon } from "lucide-react";

export function NotFoundPage() {
  return (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>

        <EmptyTitle>Page not found</EmptyTitle>

        <EmptyDescription>
          This page doesn't exist, or you don't have access to it.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>
          Go home
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  return (
    <Empty className="min-h-[60svh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>

        <EmptyTitle>Something went wrong</EmptyTitle>

        <EmptyDescription>
          {error instanceof Error ? error.message : "Unknown error"}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button onClick={reset}>Try again</Button>
      </EmptyContent>
    </Empty>
  );
}
