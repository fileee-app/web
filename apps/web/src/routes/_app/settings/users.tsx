import { createFileRoute, redirect } from "@tanstack/react-router";
import { orpc } from "../../../lib/orpc.ts";
import { pageTitle } from "../../../lib/title.ts";
import { UsersPage } from "../../../modules/settings/users/users-page.tsx";

export const Route = createFileRoute("/_app/settings/users")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "admin") throw redirect({ to: "/settings/account" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.user.list.queryOptions()),
  head: ({ matches }) => pageTitle("Users", matches),
  component: UsersPage,
});
