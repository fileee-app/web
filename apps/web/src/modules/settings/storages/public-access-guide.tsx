import { type Provider } from "@fileee/api/schemas";

const PER_BUCKET = "Public access is usually set per bucket, so plan on a separate bucket.";

const GUIDE: Record<Provider, string> = {
  s3: "CloudFront can serve just one prefix, using an origin path and a bucket policy limited to it, so a prefix should work.",
  r2: "A custom domain exposes the whole bucket, so you should need a separate bucket.",
  b2: "Making a bucket public exposes all of it, so you should need a separate bucket.",
  wasabi: PER_BUCKET,
  tigris: PER_BUCKET,
  spaces: PER_BUCKET,
  hetzner: PER_BUCKET,
  scaleway: PER_BUCKET,
  linode: PER_BUCKET,
  vultr: PER_BUCKET,
  ovh: PER_BUCKET,
  minio:
    "A reverse proxy or an anonymous policy can be limited to one prefix, so a prefix should work.",
  other: "Use a separate bucket unless your CDN can be limited to one prefix.",
};

export function PublicAccessGuide({ provider }: { provider: Provider }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      <p>
        Point your CDN at the public location and nothing else. Providers that expose a whole bucket
        through a custom domain or public setting need the separate bucket.{" "}
        <span className="text-foreground">{GUIDE[provider]}</span> This guidance is unconfirmed
        until the conformance test has run against that provider, so the safety check below is what
        counts.
      </p>

      <p>
        Saving writes one test object to the public location and two under your private prefix. The
        first must load through the CDN and the others must not, or the setting is refused. The test
        repeats with each sync.
      </p>

      <p>
        Set a short cache lifetime on the CDN, such as one hour. A removed file stays reachable
        until its cached copies expire.
      </p>
    </div>
  );
}
