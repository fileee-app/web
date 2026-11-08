import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "../../lib/title.ts";
import { BrowserPage } from "../../modules/browser/browser-page.tsx";
import { BrowserSkeleton } from "../../modules/browser/browser-skeleton.tsx";
import { folderOptions, fileOptions } from "../../modules/browser/queries.ts";

export const Route = createFileRoute("/_app/s/$storageId/$")({
  loader: async ({ context: { queryClient }, params }) => {
    const { folder } = await queryClient.ensureQueryData(
      folderOptions(params.storageId, params._splat ?? ""),
    );

    await queryClient.ensureInfiniteQueryData(fileOptions(params.storageId, folder.id));
  },
  head: ({ matches }) => pageTitle("Files", matches),
  pendingComponent: BrowserSkeleton,
  component: BrowserPage,
});
