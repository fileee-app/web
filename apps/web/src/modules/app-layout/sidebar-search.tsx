import {
  useSidebar,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarInput,
} from "@fileee/ui/components/sidebar";
import { useNavigate, useLocation, Link } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";

/** The box goes to /search, which has its own: there, and while collapsed to icons, this is just a link. */
export function SidebarSearch() {
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  const onSearchPage = useLocation({ select: (location) => location.pathname === "/search" });

  const link = (
    <SidebarMenuButton
      tooltip="Search"
      render={<Link to="/search" search={{}} activeProps={{ "data-active": true }} />}
    >
      <SearchIcon />
      <span>Search</span>
    </SidebarMenuButton>
  );

  if (onSearchPage) return <SidebarMenuItem>{link}</SidebarMenuItem>;

  return (
    <SidebarMenuItem>
      <div className="hidden group-data-[collapsible=icon]:block">{link}</div>

      <form
        className="mb-1 group-data-[collapsible=icon]:hidden"
        onSubmit={(e) => {
          e.preventDefault();

          const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement;

          setOpenMobile(false);
          void navigate({ to: "/search", search: { q: input.value.trim() || undefined } });
          input.value = "";
        }}
      >
        <SidebarInput
          className="h-9"
          name="q"
          type="search"
          placeholder="Search files"
          aria-label="Search files"
          maxLength={200}
        />
      </form>
    </SidebarMenuItem>
  );
}
