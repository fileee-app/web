import { createFileRoute, redirect } from "@tanstack/react-router";
import { orpc } from "../lib/orpc.ts";
import { AppLayout } from "../modules/app-layout/app-layout.tsx";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery(orpc.auth.me.queryOptions());

    if (!user) throw redirect({ to: "/login" });

    return { user };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.storage.list.queryOptions()),
  component: AppLayout,
});
