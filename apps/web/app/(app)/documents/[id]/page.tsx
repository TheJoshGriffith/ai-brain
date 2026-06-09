import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { accessService, authService, commentService, documentService, sharingService, tagService } from "@/lib/services";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { DocumentEditor } from "./document-editor";
import { TagEditor } from "./tag-editor";
import { ShareControls } from "./share-controls";
import { CommentsPanel } from "./comments-panel";
import { reindexAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user) notFound();
  const access = await accessService().resolveDocumentAccess(session.user.id, id);
  if (!access?.canRead) notFound();
  const doc = await documentService().getByIdUnscoped(id);
  if (!doc) notFound();

  const [backlinks, docTags, comments, author] = await Promise.all([
    documentService().backlinks(session.user.id, id),
    tagService().getDocumentTags(id),
    commentService().list(session.user.id, id),
    authService().getUserById(doc.authorId),
  ]);
  const [members, links] = access.canWrite
    ? await Promise.all([
        sharingService().listDocumentMembers(session.user.id, id),
        sharingService().listDocumentLinks(session.user.id, id),
      ])
    : [[], []];

  return (
    <div className="editor-grid">
      <DocumentEditor id={doc.id} initialTitle={doc.title} initialContent={doc.content} readOnly={!access.canWrite} />

      <aside className="editor-aside">
        <div className="meta-block">
          <h5>Properties</h5>
          <div className="meta-row">
            <span className="k">Access</span>
            <span className="v"><span className="badge accent">{access.role}</span></span>
          </div>
          <div className="meta-row">
            <span className="k">Author</span>
            <span className="v">{author?.name ?? author?.email ?? "—"}</span>
          </div>
          <div className="meta-row">
            <span className="k">Updated</span>
            <span className="v mono">{new Date(doc.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="meta-block">
          <h5>Index status</h5>
          <div className="meta-row">
            <span className="k">Embedding</span>
            <span className="v">
              <span className="badge">
                <span className={`dot ${doc.indexStatus === "indexed" ? "dot-green" : doc.indexStatus === "pending" ? "dot-amber" : "dot-gray"}`} />
                {doc.indexStatus === "pending" ? "indexing" : doc.indexStatus}
              </span>
            </span>
          </div>
          {access.canWrite ? (
            <form action={reindexAction}>
              <input type="hidden" name="id" value={doc.id} />
              <button type="submit" className="btn btn-sm" style={{ width: "100%" }}>Re-index now</button>
            </form>
          ) : null}
        </div>

        <div className="meta-block">
          <h5>Tags</h5>
          <TagEditor documentId={doc.id} initialTags={docTags} canWrite={access.canWrite} />
        </div>

        {access.canWrite ? (
          <div className="meta-block">
            <h5>Share</h5>
            <ShareControls documentId={doc.id} members={members} links={links} />
          </div>
        ) : null}

        <CommentsPanel
          documentId={doc.id}
          comments={comments}
          currentUserId={session.user.id}
          canComment={access.canComment}
          canManage={access.canManage}
        />

        <BacklinksPanel backlinks={backlinks} />
      </aside>
    </div>
  );
}
