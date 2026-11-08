CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"appName" text,
	"setupCompletedAt" timestamp (3) with time zone NOT NULL,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" text PRIMARY KEY NOT NULL,
	"storageId" text NOT NULL,
	"folderId" text NOT NULL,
	"uploaderId" text,
	"name" text NOT NULL,
	"objectKey" text NOT NULL,
	"size" bigint NOT NULL,
	"mimeType" text,
	"etag" text,
	"sha256" text,
	"thumbnailKey" text,
	"metadata" jsonb,
	"status" text NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"trashedAt" timestamp (3) with time zone,
	"modifiedAt" timestamp (3) with time zone NOT NULL,
	"lastSeenAt" timestamp (3) with time zone,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder" (
	"id" text PRIMARY KEY NOT NULL,
	"storageId" text NOT NULL,
	"parentId" text,
	"name" text NOT NULL,
	"trashedAt" timestamp (3) with time zone,
	"purgingAt" timestamp (3) with time zone,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"runAt" timestamp (3) with time zone NOT NULL,
	"leaseUntil" timestamp (3) with time zone,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempt" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"windowStartedAt" timestamp (3) with time zone NOT NULL,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_file" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"storageId" text NOT NULL,
	"fileId" text,
	"bucket" text NOT NULL,
	"publicKey" text NOT NULL,
	"url" text NOT NULL,
	"sourceEtag" text,
	"copiedAt" timestamp (3) with time zone,
	"unpublishedAt" timestamp (3) with time zone,
	"deleteError" text,
	"retiredConnection" jsonb,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp (3) with time zone NOT NULL,
	"absoluteExpiresAt" timestamp (3) with time zone NOT NULL,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "session_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "share_link" (
	"id" text PRIMARY KEY NOT NULL,
	"fileId" text,
	"folderId" text,
	"tokenHash" text NOT NULL,
	"passwordHash" text,
	"expiresAt" timestamp (3) with time zone,
	"revokedAt" timestamp (3) with time zone,
	"downloadCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "share_link_tokenHash_unique" UNIQUE("tokenHash"),
	CONSTRAINT "share_link_one_target" CHECK (("share_link"."fileId" is null) <> ("share_link"."folderId" is null))
);
--> statement-breakpoint
CREATE TABLE "storage" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"endpoint" text,
	"region" text NOT NULL,
	"bucket" text NOT NULL,
	"prefix" text DEFAULT '' NOT NULL,
	"forcePathStyle" boolean DEFAULT false NOT NULL,
	"encryptedCredentials" text NOT NULL,
	"keyVersion" integer NOT NULL,
	"status" text DEFAULT 'unchecked' NOT NULL,
	"lastCheckedAt" timestamp (3) with time zone,
	"cdnBaseUrl" text,
	"publicBucket" text,
	"publicPrefix" text,
	"publicCheckError" text,
	"publicCheckedAt" timestamp (3) with time zone,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" text PRIMARY KEY NOT NULL,
	"storageId" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"startedAt" timestamp (3) with time zone NOT NULL,
	"finishedAt" timestamp (3) with time zone,
	"continuationToken" text,
	"listed" integer DEFAULT 0 NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"markedMissing" integer DEFAULT 0 NOT NULL,
	"error" text,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload" (
	"id" text PRIMARY KEY NOT NULL,
	"fileId" text NOT NULL,
	"s3UploadId" text,
	"partSize" bigint,
	"expiresAt" timestamp (3) with time zone NOT NULL,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "upload_fileId_unique" UNIQUE("fileId")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"passwordHash" text NOT NULL,
	"role" text NOT NULL,
	"disabledAt" timestamp (3) with time zone,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_storageId_storage_id_fk" FOREIGN KEY ("storageId") REFERENCES "public"."storage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_folderId_folder_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_uploaderId_user_id_fk" FOREIGN KEY ("uploaderId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_storageId_storage_id_fk" FOREIGN KEY ("storageId") REFERENCES "public"."storage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_parentId_folder_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_file" ADD CONSTRAINT "public_file_fileId_file_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_fileId_file_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_folderId_folder_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage" ADD CONSTRAINT "storage_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_storageId_storage_id_fk" FOREIGN KEY ("storageId") REFERENCES "public"."storage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload" ADD CONSTRAINT "upload_fileId_file_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_key_unique" ON "file" USING btree ("storageId","objectKey");--> statement-breakpoint
CREATE UNIQUE INDEX "file_name_unique" ON "file" USING btree ("storageId","folderId","name") WHERE "file"."trashedAt" is null and "file"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "file_folder_name_idx" ON "file" USING btree ("storageId","folderId","name");--> statement-breakpoint
CREATE INDEX "file_modified_idx" ON "file" USING btree ("storageId","modifiedAt");--> statement-breakpoint
CREATE INDEX "file_status_idx" ON "file" USING btree ("storageId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "folder_name_unique" ON "folder" USING btree ("storageId","parentId","name") WHERE "folder"."trashedAt" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "folder_root_unique" ON "folder" USING btree ("storageId") WHERE "folder"."parentId" is null;--> statement-breakpoint
CREATE INDEX "job_due_idx" ON "job" USING btree ("status","runAt");--> statement-breakpoint
CREATE UNIQUE INDEX "public_file_live_unique" ON "public_file" USING btree ("fileId") WHERE "public_file"."unpublishedAt" is null;--> statement-breakpoint
CREATE INDEX "public_file_storage_idx" ON "public_file" USING btree ("storageId","unpublishedAt");--> statement-breakpoint
CREATE INDEX "public_file_key_idx" ON "public_file" USING btree ("storageId","publicKey");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "share_link_file_idx" ON "share_link" USING btree ("fileId");--> statement-breakpoint
CREATE INDEX "share_link_folder_idx" ON "share_link" USING btree ("folderId");--> statement-breakpoint
CREATE INDEX "storage_user_idx" ON "storage" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "sync_run_storage_idx" ON "sync_run" USING btree ("storageId","startedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_run_active_unique" ON "sync_run" USING btree ("storageId") WHERE "sync_run"."status" in ('queued', 'running');