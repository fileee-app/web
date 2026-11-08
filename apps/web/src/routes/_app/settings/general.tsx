import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageTitle } from "../../../lib/title.ts";
import { GeneralPage } from "../../../modules/settings/general/general-page.tsx";

export const Route = createFileRoute("/_app/settings/general")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "admin") throw redirect({ to: "/settings/account" });
  },
  head: ({ matches }) => pageTitle("General", matches),
  component: GeneralPage,
});
