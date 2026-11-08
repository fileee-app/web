import { SidebarProvider, SidebarInset } from "@fileee/ui/components/sidebar";
import { Outlet } from "@tanstack/react-router";
import { AppSidebar } from "./app-sidebar.tsx";
import { CommandPalette } from "./command-palette.tsx";
import { UploadTray } from "./upload-tray.tsx";

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <Outlet />
      </SidebarInset>

      <UploadTray />
      <CommandPalette />
    </SidebarProvider>
  );
}
