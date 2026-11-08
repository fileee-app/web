import { type ReactNode } from "react";

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-48 w-full items-center justify-center">{children}</div>;
}
