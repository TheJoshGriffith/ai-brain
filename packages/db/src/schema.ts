import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Default embedding dimension. Kept in sync with EMBEDDING_MODEL in .env
 * (Xenova/bge-small-en-v1.5 → 384). Changing the provider/model to a different
 * width requires a migration that alters the `document_chunks.embedding` column.
 */
export const EMBEDDING_DIMENSIONS = 384;

/** Postgres full-text search vector type (not built into drizzle-orm). */
const tsvector = customType<{ data: string; notNull: false; default: false }>({
  dataType() {
    return "tsvector";
  },
});

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Auth — shapes are compatible with @auth/drizzle-adapter so SSO/OIDC providers
// drop in later without a migration. Credentials login uses users.password_hash.
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: id(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt,
  updatedAt,
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// Personal Access Tokens — authenticate REST + MCP. Only the sha256 hash is
// stored; the raw token is shown once at creation.
// ---------------------------------------------------------------------------

export const personalAccessTokens = pgTable(
  "personal_access_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [index("pat_user_id_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Spaces — named containers for documents (vaults/workspaces). Access to a
// document flows from membership in its space. Every user gets a Personal space.
// ---------------------------------------------------------------------------

/** Roles, lowest → highest privilege. Validated in core (see TOKEN_SCOPES/roles). */
export const SPACE_ROLES = ["viewer", "commenter", "editor", "owner"] as const;
export type SpaceRole = (typeof SPACE_ROLES)[number];

export const spaces = pgTable(
  "spaces",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isPersonal: boolean("is_personal").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [index("spaces_owner_idx").on(t.ownerId)],
);

export const spaceMembers = pgTable(
  "space_members",
  {
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<SpaceRole>().notNull().default("viewer"),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.userId] }),
    index("space_members_user_idx").on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// Documents — Markdown is the source of truth. content_tsv is a stored
// generated column (title + content) indexed with GIN for full-text search.
// ---------------------------------------------------------------------------

export const documents = pgTable(
  "documents",
  {
    id: id(),
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    // Attribution only — access is governed by space membership, not this.
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    content: text("content").notNull().default(""),
    frontmatter: jsonb("frontmatter").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    contentTsv: tsvector("content_tsv").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))`,
    ),
    // Embedding/index lifecycle — stamped by the background worker.
    indexStatus: text("index_status").$type<"pending" | "indexed" | "failed">().notNull().default("pending"),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    // Soft delete — moved to Trash, purged by the worker after retention.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    // Slug is unique among *live* docs only, so trashed docs don't block reuse.
    uniqueIndex("documents_space_slug_idx").on(t.spaceId, t.slug).where(sql`${t.deletedAt} is null`),
    index("documents_space_idx").on(t.spaceId),
    index("documents_author_idx").on(t.authorId),
    index("documents_content_tsv_idx").using("gin", t.contentTsv),
  ],
);

// ---------------------------------------------------------------------------
// Document versions — full-content snapshots; rapid same-author edits coalesce.
// ---------------------------------------------------------------------------

export const documentVersions = pgTable(
  "document_versions",
  {
    id: id(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    frontmatter: jsonb("frontmatter").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt,
  },
  (t) => [uniqueIndex("document_versions_doc_version_idx").on(t.documentId, t.version)],
);

// ---------------------------------------------------------------------------
// Per-document access overrides (grant a specific user a role on one document,
// independent of space membership) and public share links.
// ---------------------------------------------------------------------------

export const documentMembers = pgTable(
  "document_members",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<SpaceRole>().notNull().default("viewer"),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    index("document_members_user_idx").on(t.userId),
  ],
);

export const documentShares = pgTable(
  "document_shares",
  {
    id: id(),
    resourceType: text("resource_type").$type<"document" | "space">().notNull(),
    resourceId: text("resource_id").notNull(),
    role: text("role").$type<SpaceRole>().notNull().default("viewer"),
    allowAnonymous: boolean("allow_anonymous").notNull().default(false),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [index("document_shares_resource_idx").on(t.resourceType, t.resourceId)],
);

// ---------------------------------------------------------------------------
// Document chunks — embedded for semantic search. Re-chunked + re-embedded on
// every document write.
// ---------------------------------------------------------------------------

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: id(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt,
  },
  (t) => [
    index("document_chunks_document_id_idx").on(t.documentId),
    index("document_chunks_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

// ---------------------------------------------------------------------------
// Links — wiki-style [[links]]. target_document_id is null until the target
// exists (unresolved); resolution fills it in when the target is created.
// ---------------------------------------------------------------------------

export const links = pgTable(
  "links",
  {
    id: id(),
    sourceDocumentId: text("source_document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    targetDocumentId: text("target_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    targetRaw: text("target_raw").notNull(),
    type: text("type").notNull().default("wikilink"),
    createdAt,
  },
  (t) => [
    index("links_source_idx").on(t.sourceDocumentId),
    index("links_target_idx").on(t.targetDocumentId),
    index("links_target_raw_idx").on(t.targetRaw),
  ],
);

// ---------------------------------------------------------------------------
// Comments — threads on a document. Commenters and above can post.
// ---------------------------------------------------------------------------

export const comments = pgTable(
  "comments",
  {
    id: id(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index("comments_document_idx").on(t.documentId)],
);

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tags = pgTable(
  "tags",
  {
    id: id(),
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt,
  },
  (t) => [uniqueIndex("tags_space_name_idx").on(t.spaceId, t.name)],
);

export const documentTags = pgTable(
  "document_tags",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.tagId] })],
);

// ---------------------------------------------------------------------------
// Jobs — Postgres-backed background queue (claimed with FOR UPDATE SKIP LOCKED).
// ---------------------------------------------------------------------------

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    type: text("type").$type<"reindex" | "purge_trash">().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: text("status").$type<"pending" | "running" | "done" | "failed">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => [index("jobs_status_run_at_idx").on(t.status, t.runAt)],
);

// ---------------------------------------------------------------------------
// Account hardening — password reset, invitations, and global app settings.
// ---------------------------------------------------------------------------

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt,
});

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [index("invitations_email_idx").on(t.email)],
);

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("global"),
  registrationMode: text("registration_mode").$type<"open" | "invite" | "closed">().notNull().default("open"),
  updatedAt,
});

// ---------------------------------------------------------------------------
// Inferred row types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PersonalAccessToken = typeof personalAccessTokens.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type SpaceMember = typeof spaceMembers.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type DocumentMember = typeof documentMembers.$inferSelect;
export type DocumentShare = typeof documentShares.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type RegistrationMode = "open" | "invite" | "closed";
