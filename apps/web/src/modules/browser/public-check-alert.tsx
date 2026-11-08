import { Alert, AlertTitle, AlertDescription } from "@fileee/ui/components/alert";
import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";

export function PublicCheckAlert({ error }: { error: string }) {
  return (
    <Alert variant="destructive" className="mx-4 mt-4 w-auto md:mx-6">
      <TriangleAlertIcon />
      <AlertTitle>The CDN safety check is failing, so publishing is blocked</AlertTitle>

      <AlertDescription className="break-words">
        <p>{error}</p>

        <Link to="/settings/storages" className="underline">
          Review public access
        </Link>
      </AlertDescription>
    </Alert>
  );
}
