import { createFileRoute } from "@tanstack/react-router";
import { orpc } from "../../lib/orpc.ts";
import { pageTitle } from "../../lib/title.ts";
import { HomePage } from "../../modules/home/home-page.tsx";

export const Route = createFileRoute("/_app/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(orpc.storage.list.queryOptions()),
      context.queryClient.ensureQueryData(orpc.file.recent.queryOptions()),
      context.queryClient.ensureQueryData(orpc.file.starred.queryOptions()),
    ]),
  head: ({ matches }) => pageTitle("Home", matches),
  component: HomePage,
});
