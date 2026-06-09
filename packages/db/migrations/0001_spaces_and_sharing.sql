-- Spaces, membership, per-document overrides, and public share links.
-- Data-preserving: each existing user gets a Personal space; their documents
-- (and tags) are moved into it. Hand-authored to keep existing rows.

-- 1. New tables -------------------------------------------------------------
CREATE TABLE "spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_personal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_members" (
	"space_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_members_space_id_user_id_pk" PRIMARY KEY("space_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "document_members" (
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_members_document_id_user_id_pk" PRIMARY KEY("document_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "document_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"allow_anonymous" boolean DEFAULT false NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_shares_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_members" ADD CONSTRAINT "document_members_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_members" ADD CONSTRAINT "document_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spaces_owner_idx" ON "spaces" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "space_members_user_idx" ON "space_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_members_user_idx" ON "document_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_shares_resource_idx" ON "document_shares" USING btree ("resource_type","resource_id");--> statement-breakpoint

-- 2. A Personal space + owner membership for every existing user ------------
INSERT INTO "spaces" ("id", "owner_id", "name", "slug", "is_personal")
SELECT gen_random_uuid()::text, u."id", 'Personal', 'personal', true FROM "users" u;--> statement-breakpoint
INSERT INTO "space_members" ("space_id", "user_id", "role")
SELECT s."id", s."owner_id", 'owner' FROM "spaces" s WHERE s."is_personal" = true;--> statement-breakpoint

-- 3. documents: add space_id, backfill from each owner's Personal space,
--    rename owner_id -> author_id, swap the slug uniqueness to per-space ------
ALTER TABLE "documents" ADD COLUMN "space_id" text;--> statement-breakpoint
UPDATE "documents" d SET "space_id" = s."id"
FROM "spaces" s WHERE s."owner_id" = d."owner_id" AND s."is_personal" = true;--> statement-breakpoint
ALTER TABLE "documents" RENAME COLUMN "owner_id" TO "author_id";--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "space_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX "documents_owner_slug_idx";--> statement-breakpoint
DROP INDEX "documents_owner_idx";--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_space_slug_idx" ON "documents" USING btree ("space_id","slug");--> statement-breakpoint
CREATE INDEX "documents_space_idx" ON "documents" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "documents_author_idx" ON "documents" USING btree ("author_id");--> statement-breakpoint

-- 4. tags: move from owner (user) to space scoping --------------------------
ALTER TABLE "tags" ADD COLUMN "space_id" text;--> statement-breakpoint
UPDATE "tags" t SET "space_id" = s."id"
FROM "spaces" s WHERE s."owner_id" = t."owner_id" AND s."is_personal" = true;--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT "tags_owner_id_users_id_fk";--> statement-breakpoint
DROP INDEX "tags_owner_name_idx";--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "space_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_space_name_idx" ON "tags" USING btree ("space_id","name");
