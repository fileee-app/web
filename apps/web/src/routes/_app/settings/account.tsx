import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "../../../lib/title.ts";
import { AccountPage } from "../../../modules/settings/account/account-page.tsx";

export const Route = createFileRoute("/_app/settings/account")({
  head: ({ matches }) => pageTitle("Account", matches),
  component: AccountPage,
});
