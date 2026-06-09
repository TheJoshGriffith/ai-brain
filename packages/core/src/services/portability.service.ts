import { and, eq, isNull } from "drizzle-orm";
import { documents, type Database } from "@ai-brain/db";
import matter from "gray-matter";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { AccessService } from "./access.service";
import { DocumentForbiddenError } from "./document.service";
import { DocumentService } from "./document.service";
import { TagService } from "./tag.service";
import { parseMarkdown, slugify } from "../markdown/parse";

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/** Markdown-file import/export for spaces and documents (Obsidian-style). */
export class PortabilityService {
  private readonly access: AccessService;
  private readonly documentsSvc: DocumentService;
  private readonly tagsSvc: TagService;
  constructor(private readonly db: Database) {
    this.access = new AccessService(db);
    this.documentsSvc = new DocumentService(db);
    this.tagsSvc = new TagService(db);
  }

  /** Serialise a document to a Markdown file with YAML frontmatter. */
  private toMarkdown(doc: { title: string; slug: string; content: string; createdAt: Date; updatedAt: Date }, tags: string[]): string {
    const { body } = parseMarkdown(doc.content); // strip any existing frontmatter to avoid duplication
    return matter.stringify(body, {
      title: doc.title,
      slug: doc.slug,
      tags,
      created: doc.createdAt.toISOString(),
      updated: doc.updatedAt.toISOString(),
    });
  }

  /** Export a whole space as a zip of `<slug>.md` files + manifest.json. */
  async exportSpace(userId: string, spaceId: string): Promise<{ filename: string; bytes: Uint8Array }> {
    if (!(await this.access.resolveSpaceRole(userId, spaceId))) throw new DocumentForbiddenError();
    const rows = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.spaceId, spaceId), isNull(documents.deletedAt)));
    const tagMap = await this.tagsSvc.tagsByDocuments(rows.map((r) => r.id));

    const files: Record<string, Uint8Array> = {};
    const seen = new Set<string>();
    for (const doc of rows) {
      let name = `${doc.slug}.md`;
      for (let i = 2; seen.has(name); i++) name = `${doc.slug}-${i}.md`;
      seen.add(name);
      files[name] = strToU8(this.toMarkdown(doc, tagMap[doc.id] ?? []));
    }
    files["manifest.json"] = strToU8(JSON.stringify({ documents: rows.length, exportedAt: new Date().toISOString() }, null, 2));

    return { filename: `space-${spaceId}.zip`, bytes: zipSync(files) };
  }

  /** Export a single document as Markdown. */
  async exportDocument(userId: string, id: string): Promise<{ filename: string; text: string }> {
    const access = await this.access.resolveDocumentAccess(userId, id);
    if (!access?.canRead) throw new DocumentForbiddenError();
    const doc = await this.documentsSvc.getByIdUnscoped(id);
    if (!doc) throw new DocumentForbiddenError();
    const tags = await this.tagsSvc.getDocumentTags(id);
    return { filename: `${doc.slug}.md`, text: this.toMarkdown(doc, tags) };
  }

  /** Import Markdown files into a space (editor+). Wiki-links resolve naturally. */
  async importFiles(userId: string, spaceId: string, files: { name: string; content: string }[]): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".md")) {
        result.skipped++;
        continue;
      }
      try {
        const { frontmatter, body } = parseMarkdown(file.content);
        const baseName = file.name.replace(/.*\//, "").replace(/\.md$/i, "");
        const title = typeof frontmatter.title === "string" && frontmatter.title.trim() ? frontmatter.title.trim() : baseName;
        const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [];
        const path = file.name.includes("/") ? file.name.replace(/\/[^/]*$/, "") : undefined;

        const doc = await this.documentsSvc.create(userId, spaceId, {
          title,
          content: path ? matter.stringify(body, { path }) : file.content,
          slug: slugify(baseName),
        });
        if (tags.length) await this.tagsSvc.setDocumentTags(userId, doc.id, tags);
        result.imported++;
      } catch (error) {
        result.errors.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
        result.skipped++;
      }
    }
    return result;
  }

  /** Unzip a `.zip` into `{ name, content }` Markdown entries. */
  static unzipMarkdown(bytes: Uint8Array): { name: string; content: string }[] {
    const entries = unzipSync(bytes);
    return Object.entries(entries)
      .filter(([name]) => name.toLowerCase().endsWith(".md"))
      .map(([name, data]) => ({ name, content: strFromU8(data) }));
  }
}
