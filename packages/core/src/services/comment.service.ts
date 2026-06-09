import { and, asc, eq } from "drizzle-orm";
import { comments, users, type Database } from "@ai-brain/db";
import { z } from "zod";
import { AccessService } from "./access.service";
import { DocumentForbiddenError, DocumentNotFoundError } from "./document.service";

export const addCommentSchema = z.object({ body: z.string().trim().min(1).max(5000) });

export interface CommentView {
  id: string;
  body: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  createdAt: Date;
}

export class CommentService {
  private readonly access: AccessService;
  constructor(private readonly db: Database) {
    this.access = new AccessService(db);
  }

  /** Comments on a document (requires read access). */
  async list(userId: string, documentId: string): Promise<CommentView[]> {
    const acc = await this.access.resolveDocumentAccess(userId, documentId);
    if (!acc?.canRead) throw new DocumentForbiddenError();
    return this.db
      .select({
        id: comments.id,
        body: comments.body,
        authorId: comments.authorId,
        authorName: users.name,
        authorEmail: users.email,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(eq(comments.documentId, documentId))
      .orderBy(asc(comments.createdAt));
  }

  /** Post a comment (requires comment access — commenter and above). */
  async add(userId: string, documentId: string, input: { body: string }): Promise<CommentView> {
    const acc = await this.access.resolveDocumentAccess(userId, documentId);
    if (!acc) throw new DocumentNotFoundError();
    if (!acc.canComment) throw new DocumentForbiddenError();
    const { body } = addCommentSchema.parse(input);

    const [row] = await this.db
      .insert(comments)
      .values({ documentId, authorId: userId, body })
      .returning();
    if (!row) throw new Error("Failed to add comment");
    const author = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    return {
      id: row.id,
      body: row.body,
      authorId: userId,
      authorName: author?.name ?? null,
      authorEmail: author?.email ?? "",
      createdAt: row.createdAt,
    };
  }

  /** Delete a comment (its author, or a space owner). */
  async remove(userId: string, commentId: string): Promise<boolean> {
    const comment = await this.db.query.comments.findFirst({ where: eq(comments.id, commentId) });
    if (!comment) return false;
    const acc = await this.access.resolveDocumentAccess(userId, comment.documentId);
    const allowed = comment.authorId === userId || acc?.canManage === true;
    if (!allowed) throw new DocumentForbiddenError();
    await this.db.delete(comments).where(eq(comments.id, commentId));
    return true;
  }
}
