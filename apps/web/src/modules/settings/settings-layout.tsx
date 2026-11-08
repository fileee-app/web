import { getRouteApi, Link, Outlet } from "@tanstack/react-router";
import { UserIcon, DatabaseIcon, SlidersHorizontalIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "../../components/page-header.tsx";

const route = getRouteApi("/_app/settings");

export function SettingsLayout() {
  const { user } = route.useRouteContext();

  const items = [
    { to: "/settings/account", label: "Account", icon: UserIcon },
    { to: "/settings/storages", label: "Storages", icon: DatabaseIcon },
    ...(user.role === "admin"
      ? [
          { to: "/settings/general", label: "General", icon: SlidersHorizontalIcon },
          { to: "/settings/users", label: "Users", icon: UsersIcon },
        ]
      : []),
  ] as const;

  return (
    <>
      <PageHeader>Settings</PageHeader>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:flex-row md:gap-10 md:p-8">
        <nav
          aria-label="Settings"
          className="no-scrollbar -mx-4 flex shrink-0 gap-1 overflow-x-auto px-4 md:sticky md:top-22 md:mx-0 md:w-44 md:flex-col lg:w-52 md:self-start md:px-0"
        >
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:bg-primary/10 data-[status=active]:font-medium data-[status=active]:text-primary"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </>
  );
}
