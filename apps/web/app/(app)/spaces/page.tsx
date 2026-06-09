import Link from "next/link";
import { auth } from "@/auth";
import { spaceService } from "@/lib/services";
import { Button, Card } from "@/components/ui";
import { switchSpaceAction } from "./actions";
import { CreateSpaceForm } from "./create-space-form";

export const dynamic = "force-dynamic";

export default async function SpacesPage() {
  const session = await auth();
  if (!session?.user) return null;
  const spaces = await spaceService().list(session.user.id);

  return (
    <div className="wrap fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Access control</h1>
          <p className="page-sub">Spaces you belong to. Owners can invite members and manage roles.</p>
        </div>
      </div>
      <Card>
        <CreateSpaceForm />
      </Card>

      <div className="list">
        {spaces.map((s) => (
          <div key={s.id} className="list-row">
            <div>
              <p style={{ margin: 0, fontWeight: 500 }}>
                {s.name}
                {s.isPersonal ? <span className="faint" style={{ marginLeft: 8, fontSize: 11.5 }}>personal</span> : null}
              </p>
              <p className="faint" style={{ margin: 0, fontSize: 12 }}>your role: {s.role}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {s.role === "owner" ? (
                <Link href={`/spaces/${s.id}/settings`} className="muted" style={{ fontSize: 13, textDecoration: "none" }}>
                  Settings
                </Link>
              ) : null}
              <form action={switchSpaceAction.bind(null, s.id)}>
                <Button type="submit" variant="ghost" className="btn-sm">Open</Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
