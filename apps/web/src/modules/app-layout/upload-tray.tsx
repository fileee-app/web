import { Badge } from "@fileee/ui/components/badge";
import { Button } from "@fileee/ui/components/button";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@fileee/ui/components/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@fileee/ui/components/collapsible";
import { ScrollArea } from "@fileee/ui/components/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { UploadIcon, Minimize2Icon, Maximize2Icon, ChevronDownIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { orpc } from "../../lib/orpc.ts";
import { useUploads, clearFinishedUploads } from "../../lib/uploads.ts";
import { IconAction } from "./icon-action.tsx";
import { InterruptedRow } from "./interrupted-row.tsx";
import { UploadRow } from "./upload-row.tsx";

export function UploadTray() {
  const uploads = useUploads();
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { data: pending = [] } = useQuery(orpc.upload.listPending.queryOptions());
  const active = uploads.filter((u) => ["queued", "uploading", "finishing"].includes(u.status));

  // Pending rows the tray is already working on aren't interrupted.
  const interrupted = pending.filter(
    (p) => !uploads.some((u) => u.fileId === p.fileId && u.status !== "canceled"),
  );

  useEffect(() => {
    if (active.length === 0) return;

    const warn = (e: BeforeUnloadEvent) => e.preventDefault();

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [active.length]);

  if (uploads.length === 0 && interrupted.length === 0) return null;

  const loaded = active.reduce((sum, u) => sum + u.loaded, 0);
  const total = active.reduce((sum, u) => sum + u.size, 0);

  return (
    <Card
      size="sm"
      className={`fixed right-4 bottom-4 z-40 gap-2 shadow-lg ${expanded ? "w-[min(48rem,calc(100vw-2rem))]" : "w-[min(24rem,calc(100vw-2rem))]"}`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadIcon className="size-4" />
            {active.length ? `Uploading ${active.length}` : "Uploads"}
            {total > 0 && <Badge variant="secondary">{Math.round((loaded / total) * 100)}%</Badge>}
          </CardTitle>

          <CardAction className="flex items-center gap-1">
            {uploads.some((u) => u.status === "done" || u.status === "canceled") && (
              <Button size="sm" variant="ghost" onClick={clearFinishedUploads}>
                Clear
              </Button>
            )}

            <IconAction
              label={expanded ? "Shrink uploads" : "Enlarge uploads"}
              onClick={() => {
                setExpanded(!expanded);
                setOpen(true);
              }}
            >
              {expanded ? <Minimize2Icon /> : <Maximize2Icon />}
            </IconAction>

            <CollapsibleTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={open ? "Collapse uploads" : "Expand uploads"}
                />
              }
            >
              <ChevronDownIcon className={open ? "" : "rotate-180"} />
            </CollapsibleTrigger>
          </CardAction>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-2">
            <ScrollArea
              className={
                expanded
                  ? "max-h-[70svh] *:data-[slot=scroll-area-viewport]:max-h-[70svh]"
                  : "max-h-72 *:data-[slot=scroll-area-viewport]:max-h-72"
              }
            >
              <div className="flex flex-col gap-1 pr-3">
                {interrupted.map((p) => (
                  <InterruptedRow key={p.fileId} pending={p} wide={expanded} />
                ))}

                {uploads.map((item) => (
                  <UploadRow key={item.id} item={item} wide={expanded} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
