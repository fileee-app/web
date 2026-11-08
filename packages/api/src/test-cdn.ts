import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";

/**
 * Stands in for a CDN, with S3 credentials standing in for the access a real one is given.
 * `resolve` is what it can reach: a URL path to the object it serves, or null for a 404.
 */
export async function startFakeCdn(client: S3Client, Bucket: string) {
  const cdn = {
    resolve: (_path: string): { Bucket?: string; Key: string } | null => null,
    url: "",
    server: undefined as Server | undefined,
  };

  cdn.server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url!, "http://cdn").pathname.slice(1));
    const target = cdn.resolve(path);

    const object =
      target &&
      (await client
        .send(new GetObjectCommand({ Bucket: target.Bucket ?? Bucket, Key: target.Key }))
        .catch(() => null));

    if (!object) {
      res.writeHead(404).end("not here");

      return;
    }

    res.writeHead(200, {
      "Content-Type": object.ContentType ?? "application/octet-stream",
      ...(object.ContentDisposition && { "Content-Disposition": object.ContentDisposition }),
      ...(object.CacheControl && { "Cache-Control": object.CacheControl }),
    });

    res.end(await object.Body!.transformToByteArray());
  });

  await new Promise<void>((resolve) => cdn.server!.listen(0, "127.0.0.1", resolve));
  // 127.0.0.1 rather than localhost, which is APP_URL's host in tests.
  cdn.url = `http://127.0.0.1:${(cdn.server.address() as AddressInfo).port}`;

  return cdn;
}
