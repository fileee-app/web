// Runs the connection test against any bucket. Run before each release, for each provider in plan.md:
// Add CDN_BASE_URL (and PUBLIC_BUCKET or PUBLIC_PREFIX) to also run the CDN safety check, which is what confirms the provider guide in storage settings.
// S3_ENDPOINT=... S3_REGION=... S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... pnpm --filter @fileee/storage conformance
import { checkPublicAccess, createClient, testConnection, withPrefix } from "./index.ts";

const env = (name: string) => {
  const value = process.env[name];

  if (!value) throw new Error(`${name} is not set`);

  return value;
};

const config = {
  endpoint: process.env.S3_ENDPOINT ?? null,
  region: env("S3_REGION"),
  bucket: env("S3_BUCKET"),
  prefix: process.env.S3_PREFIX ?? "",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  accessKeyId: env("S3_ACCESS_KEY_ID"),
  secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
};

const client = createClient(config);
const { ok, steps } = await testConnection(client, config);

for (const s of steps) console.log(s.ok ? "PASS" : "FAIL", s.step, s.error ?? "", s.fix ?? "");

const cdnBaseUrl = process.env.CDN_BASE_URL;

const cdn = cdnBaseUrl
  ? await checkPublicAccess(client, config, {
      cdnBaseUrl,
      bucket: process.env.PUBLIC_BUCKET ?? config.bucket,
      prefix: process.env.PUBLIC_PREFIX ?? withPrefix(config.prefix, ".fileee/public"),
    })
  : null;

if (cdn) console.log(cdn.error ? "FAIL" : "PASS", "cdn safety check", cdn.error ?? "");

process.exit(ok && !cdn?.error ? 0 : 1);
