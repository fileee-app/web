import { Avatar, AvatarFallback } from "@fileee/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@fileee/ui/components/dropdown-menu";
import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarFooter,
} from "@fileee/ui/components/sidebar";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRouter, Link } from "@tanstack/react-router";
import {
  HardDriveIcon,
  HouseIcon,
  PlusIcon,
  CircleAlertIcon,
  DatabaseIcon,
  Trash2Icon,
  SettingsIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
} from "lucide-react";
import { orpc } from "../../lib/orpc.ts";
import { SidebarSearch } from "./sidebar-search.tsx";

export function AppSidebar() {
  const { data: status } = useSuspenseQuery(orpc.setup.status.queryOptions());
  const { data: user } = useSuspenseQuery(orpc.auth.me.queryOptions());
  const { data: storages } = useSuspenseQuery(orpc.storage.list.queryOptions());
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = useMutation(
    orpc.auth.logout.mutationOptions({
      onSuccess: async () => {
        await router.navigate({ to: "/login" });
        queryClient.clear();
      },
    }),
  );

  const initials = user?.name.trim().slice(0, 2).toUpperCase();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-linear-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground shadow-sm">
                <HardDriveIcon className="size-4" />
              </span>

              <span className="truncate text-base font-semibold tracking-tight">
                {status.appName}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarSearch />

              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Home"
                  render={
                    <Link
                      to="/"
                      activeOptions={{ exact: true }}
                      activeProps={{ "data-active": true }}
                    />
                  }
                >
                  <HouseIcon />
                  <span>Home</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-wider">Storages</SidebarGroupLabel>

          <SidebarGroupAction title="Connect storage" render={<Link to="/settings/storages/new" />}>
            <PlusIcon />
            <span className="sr-only">Connect storage</span>
          </SidebarGroupAction>

          <SidebarGroupContent>
            <SidebarMenu>
              {storages.map((storage) => (
                <SidebarMenuItem key={storage.id}>
                  <SidebarMenuButton
                    tooltip={storage.name}
                    render={
                      <Link
                        to="/s/$storageId/$"
                        params={{ storageId: storage.id, _splat: "" }}
                        activeProps={{ "data-active": true }}
                      />
                    }
                  >
                    {storage.status === "error" ? (
                      <CircleAlertIcon className="text-destructive" />
                    ) : (
                      <DatabaseIcon />
                    )}

                    <span className="truncate">{storage.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Trash"
              render={<Link to="/trash" activeProps={{ "data-active": true }} />}
            >
              <Trash2Icon />
              <span>Trash</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              render={<Link to="/settings" activeProps={{ "data-active": true }} />}
            >
              <SettingsIcon />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>

                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user?.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                </span>

                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" align="start" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => logout.mutate()}>
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
