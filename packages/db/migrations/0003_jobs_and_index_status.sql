-- Background job queue + document index lifecycle.
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "jobs_status_run_at_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
-- At most one queued reindex per document (coalescing). purge_trash jobs have a
-- null documentId, and NULLs are distinct, so they never collide here.
CREATE UNIQUE INDEX "jobs_pending_reindex_idx" ON "jobs" (("payload"->>'documentId')) WHERE "status" = 'pending' AND "type" = 'reindex';--> statement-breakpoint

ALTER TABLE "documents" ADD COLUMN "index_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "indexed_at" timestamp with time zone;--> statement-breakpoint
-- Existing documents were embedded synchronously on write — mark them indexed.
UPDATE "documents" SET "index_status" = 'indexed', "indexed_at" = now();
