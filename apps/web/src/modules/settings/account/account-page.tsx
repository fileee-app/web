import { getRouteApi } from "@tanstack/react-router";
import { AppearanceCard } from "./appearance-card.tsx";
import { PasswordCard } from "./password-card.tsx";
import { ProfileCard } from "./profile-card.tsx";

const route = getRouteApi("/_app/settings/account");

export function AccountPage() {
  const { user } = route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <AppearanceCard />

      <ProfileCard user={user} />

      <PasswordCard />
    </div>
  );
}
