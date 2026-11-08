import { Alert, AlertTitle, AlertDescription } from "@fileee/ui/components/alert";
import { Button } from "@fileee/ui/components/button";
import { Spinner } from "@fileee/ui/components/spinner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { TriangleAlertIcon } from "lucide-react";
import { formatDate } from "../../lib/format.ts";
import { client, orpc } from "../../lib/orpc.ts";
import { CopyField } from "./copy-field.tsx";

type PublicStatus = Awaited<ReturnType<typeof client.share.publicStatus>>;

export function PublicBody({ fileId, blockedBy, copy }: { fileId: string } & PublicStatus) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.share.key() });
  const publish = useMutation(orpc.share.publish.mutationOptions({ onSuccess: refresh }));
  const unpublish = useMutation(orpc.share.unpublish.mutationOptions({ onSuccess: refresh }));
  const busy = publish.isPending || unpublish.isPending;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {blockedBy && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Publishing is blocked</AlertTitle>

          <AlertDescription className="break-words">
            The CDN safety check is failing: {blockedBy}
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Anyone with this link can download the file</AlertTitle>

        <AlertDescription>
          It has no password or expiry and no download count. Removing it can lag behind cached
          copies, so the link may keep working until the CDN's cache expires. The copy is stored
          separately and billed by your provider.
        </AlertDescription>
      </Alert>

      {copy?.outOfDate && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>The public copy is out of date</AlertTitle>

          <AlertDescription>
            This file has changed or gone missing since it was published, and the link still serves
            the old version. Republishing replaces it with a new link.
          </AlertDescription>
        </Alert>
      )}

      {copy && (
        <CopyField
          url={copy.url}
          label={copy.outOfDate ? "Public CDN link (out of date)" : "Public CDN link"}
          note={`Published ${formatDate(copy.publishedAt)}.`}
        />
      )}

      <div className="flex justify-end gap-2">
        {copy && (
          <Button variant="outline" disabled={busy} onClick={() => unpublish.mutate({ fileId })}>
            {unpublish.isPending && <Spinner data-icon="inline-start" />}
            Unpublish
          </Button>
        )}

        {(!copy || copy.outOfDate) && (
          <Button disabled={busy || blockedBy !== null} onClick={() => publish.mutate({ fileId })}>
            {publish.isPending && <Spinner data-icon="inline-start" />}
            {copy ? "Republish" : "Publish"}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Moving this file to trash deletes the public copy, and restoring it doesn't publish it
        again. Publishing again always creates a new link.
      </p>
    </div>
  );
}
