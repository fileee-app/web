import { HardDriveIcon } from "lucide-react";
import type { ReactNode } from "react";

export function AuthLayout({ appName, children }: { appName: string; children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="flex items-center gap-2 font-medium">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <HardDriveIcon className="size-4" />
        </span>

        {appName}
      </div>

      {children}
    </main>
  );
}
