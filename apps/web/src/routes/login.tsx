import { createFileRoute, redirect } from "@tanstack/react-router";
import { orpc } from "../lib/orpc.ts";
import { pageTitle } from "../lib/title.ts";
import { LoginPage } from "../modules/login/login-page.tsx";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.fetchQuery(orpc.auth.me.queryOptions()))
      throw redirect({ to: "/" });
  },
  head: ({ matches }) => pageTitle("Sign in", matches),
  component: LoginPage,
});
