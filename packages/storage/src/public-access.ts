import { randomUUID } from "node:crypto";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { DeleteObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { withPrefix, type StorageConfig } from "./client.ts";
import { safeLookup, validateEndpoint } from "./endpoint.ts";
import { attachmentDisposition, listPrefix } from "./objects.ts";

export interface PublicLocation {
  cdnBaseUrl: string;
  bucket: string;
  prefix: string;
}

const PROBE_TIMEOUT = 10_000;
const MAX_BODY = 4096;

/** Probes outside `.fileee/` start with this, and sync skips them. */
export const PRIVATE_PROBE_PREFIX = "fileee-probe-";

/** Judged from the settings alone. The probes below judge what the CDN really does. */
export function publicLocationProblem(
  storage: { bucket: string; prefix: string },
  location: { bucket: string; prefix: string },
) {
  if (location.bucket !== storage.bucket) return null;

  const pub = listPrefix(location.prefix);
  const own = listPrefix(storage.prefix);

  if (!pub) return "The public location can't be the whole bucket, which holds private files.";

  if (own.startsWith(pub)) {
    return "The public location can't be your storage's prefix or a folder above it, which hold private files.";
  }

  // Thumbnails live under .fileee/, so only its public folder is available.
  if (pub.startsWith(`${own}.fileee/`) && !pub.startsWith(`${own}.fileee/public/`)) {
    return "That folder is reserved. Use .fileee/public/ or a folder outside .fileee/.";
  }

  return null;
}

/** Answers only: never follows a redirect, so a CDN can't send this server to a private address. */
function fetchProbe(url: string) {
  return new Promise<{ status: number; body: string; headers: IncomingHttpHeaders }>(
    (resolve, reject) => {
      const problem = validateEndpoint(url);

      if (problem) return reject(new Error(problem));

      const request = url.startsWith("https:") ? httpsRequest : httpRequest;

      const req = request(
        url,
        {
          lookup: safeLookup as never,
          timeout: PROBE_TIMEOUT,
          headers: { "Accept-Encoding": "identity" },
        },
        (res) => {
          let body = "";

          res.setEncoding("utf8");

          res.on("data", (chunk: string) => {
            body += chunk;

            if (body.length > MAX_BODY) res.destroy();
          });

          const done = () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers });

          res.on("end", done);
          res.on("close", done);
          res.on("error", reject);
        },
      );

      req.on("timeout", () => req.destroy(new Error("The CDN didn't answer in time.")));
      req.on("error", reject);
      req.end();
    },
  );
}

/**
 * Everywhere a CDN that reaches too much would serve a private key. A base URL can carry a path, so
 * `https://cdn/bucket/public` on a proxy of the whole provider is caught by walking up that path.
 */
export function privateProbeUrls(cdnBaseUrl: string, bucket: string, prefix: string, key: string) {
  const base = new URL(cdnBaseUrl);
  const parts = base.pathname.split("/").filter(Boolean);
  const relative = key.slice(listPrefix(prefix).length);
  const urls = new Set<string>();

  for (let depth = parts.length; depth >= 0; depth--) {
    const above = parts.slice(0, depth).join("/");

    for (const path of [key, `${bucket}/${key}`, relative]) {
      urls.add(new URL(`/${above ? `${above}/` : ""}${path}`, base.origin).href);
    }
  }

  return [...urls];
}

const reason = (error: unknown) => {
  const e = error as { name?: string; message?: string };

  return e.name && e.name !== "Error" ? `${e.name}: ${e.message}` : (e.message ?? "Unknown error");
};

/**
 * Publishes one probe, and hides two under the private prefix: a CDN or proxy that refuses dot folders
 * could otherwise look safe while serving everything else. Anything short of a clear answer fails.
 */
export async function checkPublicAccess(
  client: S3Client,
  config: Pick<StorageConfig, "bucket" | "prefix">,
  location: PublicLocation,
): Promise<{ error: string | null; exposed: boolean }> {
  const id = randomUUID();
  const secret = randomUUID();
  const publicKey = withPrefix(location.prefix, `probe-${id}/fileee-probe.txt`);

  const privateKeys = [
    withPrefix(config.prefix, `.fileee/probe-${id}`),
    withPrefix(config.prefix, `${PRIVATE_PROBE_PREFIX}${id}`),
  ];

  const put = (Bucket: string, Key: string, ContentDisposition?: string) =>
    client.send(
      new PutObjectCommand({
        Bucket,
        Key,
        Body: secret,
        ContentType: "text/plain",
        ContentDisposition,
      }),
    );

  const remove = (Bucket: string, Key: string) =>
    client.send(new DeleteObjectCommand({ Bucket, Key })).catch((error) => {
      console.error(`Couldn't delete safety check object ${Key}`, reason(error));
    });

  const fail = (error: string, exposed = false) => ({ error, exposed });

  try {
    try {
      await put(location.bucket, publicKey, attachmentDisposition("fileee-probe.txt"));

      for (const key of privateKeys) await put(config.bucket, key);
    } catch (error) {
      return fail(`Couldn't write a test object with these credentials: ${reason(error)}`);
    }

    const publicUrl = `${location.cdnBaseUrl}/probe-${id}/fileee-probe.txt`;
    const answer = await fetchProbe(publicUrl).catch((error: unknown) => reason(error));

    if (typeof answer === "string") {
      return fail(`The CDN couldn't be reached at ${publicUrl}: ${answer}`);
    }

    if (answer.status !== 200 || answer.body !== secret) {
      return fail(
        `The CDN should serve the public location, but ${publicUrl} answered HTTP ${answer.status} without the test object.`,
      );
    }

    if (!answer.headers["content-disposition"]?.startsWith("attachment")) {
      return fail(
        "The CDN removes the Content-Disposition header, so HTML files could run on its domain.",
      );
    }

    const attempts = privateKeys.flatMap((key) =>
      privateProbeUrls(location.cdnBaseUrl, config.bucket, config.prefix, key),
    );

    const results = await Promise.all(
      attempts.map(async (url) => ({
        url,
        answer: await fetchProbe(url).catch((error: unknown) => reason(error)),
      })),
    );

    for (const { url, answer: seen } of results) {
      if (typeof seen === "object" && seen.body.includes(secret)) {
        return fail(
          `The CDN served a private test object at ${url}, so every private file may be exposed. Point the CDN only at the public location.`,
          true,
        );
      }
    }

    for (const { url, answer: seen } of results) {
      if (typeof seen === "string") {
        return fail(`Couldn't confirm that the CDN blocks private files at ${url}: ${seen}`);
      }

      if (seen.status >= 300 && seen.status < 400) {
        return fail(`Couldn't confirm that the CDN blocks private files: ${url} is a redirect.`);
      }
    }

    return { error: null, exposed: false };
  } finally {
    await remove(location.bucket, publicKey);

    for (const key of privateKeys) await remove(config.bucket, key);
  }
}
