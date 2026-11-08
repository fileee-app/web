import { createFileRoute } from "@tanstack/react-router";
import { orpc } from "../../lib/orpc.ts";
import { pageTitle } from "../../lib/title.ts";
import { TrashPage } from "../../modules/trash/trash-page.tsx";

export const Route = createFileRoute("/_app/trash")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.trash.list.queryOptions()),
  head: ({ matches }) => pageTitle("Trash", matches),
  component: TrashPage,
});
