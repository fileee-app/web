// Browser-safe: only Zod. Shared with the web app's forms so client and server validate the same rules.
import * as z from "zod";

export const PROVIDERS = {
  s3: { label: "AWS S3", endpoint: "", region: "us-east-1", forcePathStyle: false },
  r2: {
    label: "Cloudflare R2",
    endpoint: "https://<account>.r2.cloudflarestorage.com",
    region: "auto",
    forcePathStyle: false,
  },
  b2: {
    label: "Backblaze B2",
    endpoint: "https://s3.<region>.backblazeb2.com",
    region: "",
    forcePathStyle: false,
  },
  wasabi: {
    label: "Wasabi",
    endpoint: "https://s3.<region>.wasabisys.com",
    region: "",
    forcePathStyle: false,
  },
  tigris: {
    label: "Tigris",
    endpoint: "https://t3.storage.dev",
    region: "auto",
    forcePathStyle: false,
  },
  spaces: {
    label: "DigitalOcean Spaces",
    endpoint: "https://<region>.digitaloceanspaces.com",
    region: "",
    forcePathStyle: false,
  },
  hetzner: {
    label: "Hetzner",
    endpoint: "https://<region>.your-objectstorage.com",
    region: "",
    forcePathStyle: false,
  },
  scaleway: {
    label: "Scaleway",
    endpoint: "https://s3.<region>.scw.cloud",
    region: "",
    forcePathStyle: false,
  },
  linode: {
    label: "Akamai (Linode)",
    endpoint: "https://<region>.linodeobjects.com",
    region: "",
    forcePathStyle: false,
  },
  vultr: {
    label: "Vultr",
    endpoint: "https://<region>.vultrobjects.com",
    region: "",
    forcePathStyle: false,
  },
  ovh: {
    label: "OVHcloud",
    endpoint: "https://s3.<region>.io.cloud.ovh.net",
    region: "",
    forcePathStyle: false,
  },
  minio: {
    label: "MinIO",
    endpoint: "http://localhost:9000",
    region: "us-east-1",
    forcePathStyle: true,
  },
  other: { label: "S3-compatible", endpoint: "", region: "", forcePathStyle: false },
} as const;

export type Provider = keyof typeof PROVIDERS;

const providerIds = Object.keys(PROVIDERS) as [Provider, ...Provider[]];

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(100, "At most 100 characters.");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email."));

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use at most 128 characters.");

export const appNameSchema = z.string().trim().max(50, "At most 50 characters.");

export const setupInput = z.object({
  appName: appNameSchema,
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  setupToken: z.string().max(256),
});

export const loginInput = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128),
  newPassword: passwordSchema,
});

export const createUserInput = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["admin", "user"]),
});

/** A file or folder name, which never contains a path separator. */
export const itemNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(255, "At most 255 characters.")
  .refine(
    (name) => !/[/\\]/.test(name) && name !== "." && name !== "..",
    "Names can't contain / or \\.",
  );

const storageFields = {
  name: nameSchema,
  provider: z.enum(providerIds),
  endpoint: z.string().trim().max(500),
  region: z.string().trim().min(1, "Enter a region.").max(64),
  bucket: z.string().trim().min(1, "Enter a bucket name.").max(255),
  prefix: z.string().trim().max(500),
  forcePathStyle: z.boolean(),
  accessKeyId: z.string().trim().min(1, "Enter an access key ID.").max(256),
  secretAccessKey: z.string().trim().min(1, "Enter a secret access key.").max(512),
};

const needsEndpoint = (v: { provider: Provider; endpoint: string }) =>
  v.provider === "s3" || v.endpoint !== "";

const endpointRule = { path: ["endpoint"], message: "Enter the endpoint URL." };

export const storageInput = z.object(storageFields).refine(needsEndpoint, endpointRule);

/** A blank secret keeps the stored credentials. */
export const storageUpdateInput = z
  .object({
    ...storageFields,
    secretAccessKey: z.string().trim().max(512),
    accessKeyId: z.string().trim().max(256),
  })
  .refine(needsEndpoint, endpointRule);

// EXIF and PDF strings often carry NUL padding, which Postgres can't store.
const extractedText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((text) => text.replaceAll("\0", ""))
    .optional();

/** Reported by the browser, shown only as text. */
export const fileMetadataSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().nonnegative().optional(),
  pages: z.number().int().positive().optional(),
  title: extractedText(500),
  author: extractedText(500),
  lines: z.number().int().nonnegative().optional(),
  linesPartial: z.boolean().optional(),
  encoding: extractedText(32),
  camera: extractedText(200),
  takenAt: extractedText(40),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const FILE_TYPES = [
  "image",
  "video",
  "audio",
  "pdf",
  "document",
  "text",
  "archive",
] as const;

/** Also what the /search page keeps in its URL. Blank text with filters lists what matches the filters. */
export const searchInput = z.object({
  q: z.string().trim().max(200).default(""),
  storageId: z.string().max(64).optional(),
  type: z.enum(FILE_TYPES).optional(),
  minSize: z.number().int().nonnegative().optional(),
  maxSize: z.number().int().nonnegative().optional(),
  modifiedFrom: z.iso.date().optional(),
  modifiedTo: z.iso.date().optional(),
});

export const SHARE_EXPIRY_HOURS = {
  never: null,
  "1h": 1,
  "1d": 24,
  "7d": 168,
  "30d": 720,
} as const;

export const shareInput = z.object({
  expiry: z.enum(["never", "1h", "1d", "7d", "30d"]),
  // Blank means no password. Guesses are limited per link, so this needn't be as long as an account's.
  password: z.union([
    z.literal(""),
    z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters."),
  ]),
});

export const sharePasswordInput = z.object({
  password: z.string().min(1, "Enter the password.").max(128),
});

const publicPrefixSchema = z
  .string()
  .trim()
  .max(500, "At most 500 characters.")
  .refine(
    (prefix) =>
      prefix === "" ||
      prefix
        .replace(/\/$/, "")
        .split("/")
        .every((part) => /^[\w.~-]+$/.test(part) && part !== "." && part !== ".."),
    "Use letters, numbers, . _ ~ - and single / between folders, with no . or .. folders.",
  );

/** A blank CDN URL turns public access off. A blank prefix means the default location. */
export const publicAccessInput = z.object({
  cdnBaseUrl: z.string().trim().max(500, "At most 500 characters."),
  publicBucket: z
    .string()
    .trim()
    .max(255, "At most 255 characters.")
    .refine((bucket) => !bucket.includes("/"), "Enter only the bucket's name."),
  publicPrefix: publicPrefixSchema,
});
