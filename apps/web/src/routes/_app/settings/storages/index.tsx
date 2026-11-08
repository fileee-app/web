import { createFileRoute } from "@tanstack/react-router";
import { orpc } from "../../../../lib/orpc.ts";
import { pageTitle } from "../../../../lib/title.ts";
import { StoragesPage } from "../../../../modules/settings/storages/storages-page.tsx";

export const Route = createFileRoute("/_app/settings/storages/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.storage.list.queryOptions()),
  head: ({ matches }) => pageTitle("Storages", matches),
  component: StoragesPage,
});
