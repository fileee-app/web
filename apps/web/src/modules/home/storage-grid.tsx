import { PROVIDERS } from "@fileee/api/schemas";
import { Badge } from "@fileee/ui/components/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@fileee/ui/components/card";
import { Link } from "@tanstack/react-router";
import { DatabaseIcon, PlusIcon } from "lucide-react";
import { client } from "../../lib/orpc.ts";

export function StorageGrid({
  storages,
}: {
  storages: Awaited<ReturnType<typeof client.storage.list>>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Storages</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {storages.map((storage) => (
          <Link
            key={storage.id}
            to="/s/$storageId/$"
            params={{ storageId: storage.id, _splat: "" }}
            className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Card size="sm" className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <DatabaseIcon className="size-5" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{storage.name}</span>

                    {storage.status === "error" && (
                      <Badge variant="destructive">Check failed</Badge>
                    )}
                  </CardTitle>

                  <CardDescription className="truncate">
                    {PROVIDERS[storage.provider].label} · {storage.bucket}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}

        <Link
          to="/settings/storages/new"
          className="flex min-h-16 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <PlusIcon className="size-4" />
          Connect storage
        </Link>
      </div>
    </section>
  );
}
