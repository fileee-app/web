import { Tabs, TabsList, TabsTrigger, TabsContent } from "@fileee/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { type BrowserItem } from "../../lib/item-actions.ts";
import { orpc } from "../../lib/orpc.ts";
import { PublicBody } from "./public-body.tsx";
import { ShareBody } from "./share-body.tsx";

/** The public option only exists for files on a storage with public access set up. */
export function ShareTabs({ item }: { item: BrowserItem }) {
  const status = useQuery(
    orpc.share.publicStatus.queryOptions({
      input: { fileId: item.id },
      enabled: item.kind === "file",
      staleTime: 0,
    }),
  );

  if (item.kind !== "file" || !status.data?.available)
    return <ShareBody key={item.id} item={item} />;

  return (
    <Tabs defaultValue="private" className="min-w-0">
      <TabsList className="w-full">
        <TabsTrigger value="private">Private link</TabsTrigger>
        <TabsTrigger value="public">Public CDN link</TabsTrigger>
      </TabsList>

      <TabsContent value="private" className="pt-2">
        <ShareBody key={item.id} item={item} />
      </TabsContent>

      <TabsContent value="public" className="pt-2">
        <PublicBody fileId={item.id} {...status.data} />
      </TabsContent>
    </Tabs>
  );
}
