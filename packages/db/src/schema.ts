import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const time = () => timestamp({ withTimezone: true, mode: "date", precision: 3 });

const timestamps = {
  createdAt: time()
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: time()
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

export const appSettings = pgTable("app_settings", {
  id: integer().primaryKey(), // always 1, so a second setup fails on the primary key
  appName: text(),
  setupCompletedAt: time().notNull(),
  ...timestamps,
});

export const users = pgTable("user", {
  id: id(),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text().notNull(),
  role: text({ enum: ["admin", "user"] }).notNull(),
  disabledAt: time(),
  ...timestamps,
});

export const sessions = pgTable(
  "session",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text().notNull().unique(),
    expiresAt: time().notNull(),
    absoluteExpiresAt: time().notNull(),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable("login_attempt", {
  key: text().primaryKey(),
  count: integer().notNull(),
  windowStartedAt: time().notNull(),
  ...timestamps,
});

export const storages = pgTable(
  "storage",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    provider: text({ enum: ["s3", "r2", "b2", "wasabi", "minio", "other"] }).notNull(),
    endpoint: text(),
    region: text().notNull(),
    bucket: text().notNull(),
    prefix: text().notNull().default(""),
    forcePathStyle: boolean().notNull().default(false),
    encryptedCredentials: text().notNull(),
    keyVersion: integer().notNull(),
    status: text({ enum: ["unchecked", "ok", "error"] })
      .notNull()
      .default("unchecked"),
    lastCheckedAt: time(),
    cdnBaseUrl: text(), // null means public access is off
    publicBucket: text(), // null means the storage's own bucket
    publicPrefix: text(),
    publicCheckError: text(), // why the latest safety check failed; publishing is blocked while set
    publicCheckedAt: time(),
    ...timestamps,
  },
  (t) => [index("storage_user_idx").on(t.userId)],
);

export const folders = pgTable(
  "folder",
  {
    id: id(),
    storageId: text()
      .notNull()
      .references(() => storages.id, { onDelete: "cascade" }),
    parentId: text().references((): AnyPgColumn => folders.id, { onDelete: "cascade" }), // null only on a storage's root row
    name: text().notNull(),
    trashedAt: time(),
    purgingAt: time(), // permanent delete requested; the job removes the row once its files are gone
    ...timestamps,
  },
  (t) => [
    uniqueIndex("folder_name_unique")
      .on(t.storageId, t.parentId, t.name)
      .where(sql`${t.trashedAt} is null`),
    uniqueIndex("folder_root_unique")
      .on(t.storageId)
      .where(sql`${t.parentId} is null`),
  ],
);

/** Display details only: anything sorted or filtered gets a real column. */
export interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  title?: string;
  author?: string;
  lines?: number;
  /** `lines` only counts the first 1 MiB. */
  linesPartial?: boolean;
  encoding?: string;
  camera?: string;
  takenAt?: string;
  latitude?: number;
  longitude?: number;
}

export const files = pgTable(
  "file",
  {
    id: id(),
    storageId: text()
      .notNull()
      .references(() => storages.id, { onDelete: "cascade" }),
    folderId: text()
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    uploaderId: text().references(() => users.id, { onDelete: "set null" }),
    name: text().notNull(),
    objectKey: text().notNull(),
    size: bigint({ mode: "number" }).notNull(),
    mimeType: text(),
    etag: text(),
    sha256: text(), // reported by the browser at upload, for display
    thumbnailKey: text(),
    metadata: jsonb().$type<FileMetadata>(), // null until the browser has processed the file
    status: text({ enum: ["pending", "ready", "missing", "purging"] }).notNull(),
    starred: boolean().notNull().default(false),
    trashedAt: time(),
    modifiedAt: time()
      .notNull()
      .$defaultFn(() => new Date()),
    lastSeenAt: time(), // when a sync last found the object
    ...timestamps,
  },
  (t) => [
    uniqueIndex("file_key_unique").on(t.storageId, t.objectKey),
    uniqueIndex("file_name_unique")
      .on(t.storageId, t.folderId, t.name)
      .where(sql`${t.trashedAt} is null and ${t.status} = 'ready'`),
    index("file_folder_name_idx").on(t.storageId, t.folderId, t.name),
    index("file_modified_idx").on(t.storageId, t.modifiedAt),
    index("file_status_idx").on(t.storageId, t.status),
  ],
);

/** Links to exactly one file or folder, and go when it does. Only the token's hash is stored. */
export const shareLinks = pgTable(
  "share_link",
  {
    id: id(),
    fileId: text().references(() => files.id, { onDelete: "cascade" }),
    folderId: text().references(() => folders.id, { onDelete: "cascade" }),
    tokenHash: text().notNull().unique(),
    passwordHash: text(),
    expiresAt: time(),
    revokedAt: time(),
    downloadCount: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("share_link_file_idx").on(t.fileId),
    index("share_link_folder_idx").on(t.folderId),
    check("share_link_one_target", sql`(${t.fileId} is null) <> (${t.folderId} is null)`),
  ],
);

/** Enough to reach the bucket after the storage's row is gone. The secret stays encrypted. */
export interface RetiredConnection {
  endpoint: string | null;
  region: string;
  bucket: string;
  prefix: string;
  forcePathStyle: boolean;
  encryptedCredentials: string;
  keyVersion: number;
}

/**
 * A copy stays public until it's deleted, so this record must outlive whatever caused the deletion:
 * userId and storageId have no foreign keys on purpose, and a row goes only once its object is gone.
 */
export const publicFiles = pgTable(
  "public_file",
  {
    id: id(),
    userId: text().notNull(),
    storageId: text().notNull(),
    fileId: text().references(() => files.id, { onDelete: "set null" }),
    bucket: text().notNull(),
    publicKey: text().notNull(),
    url: text().notNull(),
    sourceEtag: text(),
    copiedAt: time(), // null while the copy is being made
    unpublishedAt: time(), // set means the object is waiting to be deleted by a job
    deleteError: text(), // why the latest attempt to delete it failed
    retiredConnection: jsonb().$type<RetiredConnection>(), // set when the storage is removed
    ...timestamps,
  },
  (t) => [
    uniqueIndex("public_file_live_unique")
      .on(t.fileId)
      .where(sql`${t.unpublishedAt} is null`),
    index("public_file_storage_idx").on(t.storageId, t.unpublishedAt),
    index("public_file_key_idx").on(t.storageId, t.publicKey),
  ],
);

export const uploads = pgTable("upload", {
  id: id(),
  fileId: text()
    .notNull()
    .unique()
    .references(() => files.id, { onDelete: "cascade" }),
  s3UploadId: text(), // null for a single presigned PUT
  partSize: bigint({ mode: "number" }),
  expiresAt: time().notNull(),
  ...timestamps,
});

export const jobs = pgTable(
  "job",
  {
    id: id(),
    type: text({ enum: ["purge", "sync", "unpublish"] }).notNull(),
    payload: jsonb().$type<{ storageId: string; runId?: string }>().notNull(),
    status: text({ enum: ["pending", "running"] })
      .notNull()
      .default("pending"),
    attempts: integer().notNull().default(0),
    runAt: time().notNull(),
    leaseUntil: time(), // a running job past this was cut off by a restart, and is picked up again
    ...timestamps,
  },
  (t) => [index("job_due_idx").on(t.status, t.runAt)],
);

export const syncRuns = pgTable(
  "sync_run",
  {
    id: id(),
    storageId: text()
      .notNull()
      .references(() => storages.id, { onDelete: "cascade" }),
    trigger: text({ enum: ["connect", "manual", "schedule"] }).notNull(),
    status: text({ enum: ["queued", "running", "complete", "failed"] }).notNull(),
    startedAt: time().notNull(),
    finishedAt: time(),
    continuationToken: text(),
    listed: integer().notNull().default(0),
    added: integer().notNull().default(0),
    updated: integer().notNull().default(0),
    markedMissing: integer().notNull().default(0),
    error: text(),
    ...timestamps,
  },
  (t) => [
    index("sync_run_storage_idx").on(t.storageId, t.startedAt),
    // One run at a time per storage, enforced by the database.
    uniqueIndex("sync_run_active_unique")
      .on(t.storageId)
      .where(sql`${t.status} in ('queued', 'running')`),
  ],
);
