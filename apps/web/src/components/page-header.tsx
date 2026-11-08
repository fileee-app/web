import { Separator } from "@fileee/ui/components/separator";
import { SidebarTrigger } from "@fileee/ui/components/sidebar";
import type { ReactNode } from "react";

export function PageHeader({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:rounded-t-xl">
      <SidebarTrigger className="-ml-1" />

      <Separator
        orientation="vertical"
        className="mr-2 data-vertical:h-4 data-vertical:self-center"
      />

      <div className="min-w-0 flex-1 truncate font-medium">{children}</div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );
}
