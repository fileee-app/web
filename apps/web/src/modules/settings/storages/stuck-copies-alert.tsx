import { Alert, AlertTitle, AlertDescription } from "@fileee/ui/components/alert";
import { TriangleAlertIcon } from "lucide-react";
import { client } from "../../../lib/orpc.ts";

export function StuckCopiesAlert({
  copies,
}: {
  copies: Awaited<ReturnType<typeof client.share.removalFailures>>;
}) {
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />

      <AlertTitle>
        {copies.length} public {copies.length === 1 ? "copy" : "copies"} couldn't be deleted and{" "}
        {copies.length === 1 ? "is" : "are"} still public
      </AlertTitle>

      <AlertDescription className="break-all">
        <p>
          fileee keeps retrying. Check the storage's credentials, or delete these yourself from the
          bucket: {copies.map((copy) => copy.url).join(", ")}
        </p>

        <p>Latest error: {copies[0]!.error}</p>
      </AlertDescription>
    </Alert>
  );
}
