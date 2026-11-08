import { Skeleton } from "@fileee/ui/components/skeleton";

export function BrowserSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-6">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
