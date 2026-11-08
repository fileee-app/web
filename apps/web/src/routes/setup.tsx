import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageTitle } from "../lib/title.ts";
import { SetupPage } from "../modules/setup/setup-page.tsx";

export const Route = createFileRoute("/setup")({
  beforeLoad: ({ context }) => {
    if (context.status.complete) throw redirect({ to: "/" });
  },
  head: ({ matches }) => pageTitle("Setup", matches),
  component: SetupPage,
});
