import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { safeLookup } from "./endpoint.ts";

export interface StorageConfig {
  endpoint: string | null;
  region: string;
  bucket: string;
  prefix: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
}

export function createClient(config: StorageConfig) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint ?? undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // The SDK's default checksums break some S3-compatible providers.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 10_000,
      requestTimeout: 30_000,
      httpAgent: new HttpAgent({ lookup: safeLookup as never }),
      httpsAgent: new HttpsAgent({ lookup: safeLookup as never }),
    }),
  });
}

export const withPrefix = (prefix: string, key: string) =>
  prefix ? `${prefix.replace(/\/+$/, "")}/${key}` : key;
