import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "../../../../lib/title.ts";
import { NewStoragePage } from "../../../../modules/settings/storages/new/new-storage-page.tsx";

export const Route = createFileRoute("/_app/settings/storages/new")({
  head: ({ matches }) => pageTitle("Connect storage", matches),
  component: NewStoragePage,
});
