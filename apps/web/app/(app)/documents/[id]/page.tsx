import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { accessService, authService, commentService, documentService, sharingService, tagService } from "@/lib/services";
import { BacklinksPanel } from "@/components/backlinks-panel";
import { DocumentEditor } from "./document-editor";
import { TagEditor } from "./tag-editor";
import { ShareControls } from "./share-controls";
import { CommentsPanel } from "./comments-panel";
import { reindexAction, restoreVersionAction } from "../actions";

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

  const [backlinks, docTags, comments, author, versions] = await Promise.all([
    documentService().backlinks(session.user.id, id),
    tagService().getDocumentTags(id),
    commentService().list(session.user.id, id),
    authService().getUserById(doc.authorId),
    documentService().listVersions(session.user.id, id),
  ]);
  const [members, links] = access.canWrite
    ? await Promise.all([
        sharingService().listDocumentMembers(session.user.id, id),
        sharingService().listDocumentLinks(session.user.id, id),
      ])
    : [[], []];

  return (
    <div className="editor-grid">
      <DocumentEditor id={doc.id} initialTitle={doc.title} initialContent={doc.content} initialRevision={doc.revision} readOnly={!access.canWrite} />

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

        {versions.length > 1 ? (
          <div className="meta-block">
            <h5>History</h5>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {versions.map((v, i) => (
                <div key={v.id} className="meta-row">
                  <span className="k" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                    v{v.version} · {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                  <span className="v">
                    {i === 0 ? (
                      <span className="faint" style={{ fontSize: 11 }}>current</span>
                    ) : access.canWrite ? (
                      <form action={restoreVersionAction}>
                        <input type="hidden" name="id" value={doc.id} />
                        <input type="hidden" name="version" value={v.version} />
                        <button type="submit" className="link-accent" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5 }}>
                          restore
                        </button>
                      </form>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
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
