import { canWrite } from "@ai-brain/core";
import { auth } from "@/auth";
import { documentService } from "@/lib/services";
import { getSpacesAndCurrent } from "@/lib/current-space";
import { Button } from "@/components/ui";
import { purgeDocAction, restoreDocAction } from "../documents/actions";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const session = await auth();
  if (!session?.user) return null;
  const { current } = await getSpacesAndCurrent(session.user.id);
  const mayWrite = canWrite(current.role);
  const docs = mayWrite ? await documentService().listTrash(session.user.id, current.id) : [];

  return (
    <div className="wrap fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Trash</h1>
          <p className="page-sub">
            Deleted documents in {current.name}. Restored anytime; permanently removed after the retention window.
          </p>
        </div>
      </div>

      {!mayWrite ? (
        <p className="hint">Only editors and owners can view the trash.</p>
      ) : docs.length === 0 ? (
        <p className="hint">Trash is empty.</p>
      ) : (
        <div className="list">
          {docs.map((d) => (
            <div key={d.id} className="list-row">
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{d.title}</p>
                <p className="faint" style={{ margin: 0, fontSize: 12 }}>/{d.slug}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <form action={restoreDocAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <Button type="submit" variant="ghost" className="btn-sm">Restore</Button>
                </form>
                <form action={purgeDocAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <Button type="submit" variant="danger" className="btn-sm">Delete forever</Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
