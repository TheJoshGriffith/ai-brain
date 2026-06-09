import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { spaceService } from "@/lib/services";
import { Button, Card } from "@/components/ui";
import { deleteSpaceAction } from "../../actions";
import { MembersManager } from "../members-manager";

export const dynamic = "force-dynamic";

export default async function SpaceSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;

  const space = await spaceService().get(session.user.id, id);
  if (!space || space.role !== "owner") notFound();
  const members = await spaceService().listMembers(session.user.id, id);

  return (
    <div className="wrap fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{space.name}</h1>
          <p className="page-sub">Manage members and access.</p>
        </div>
      </div>

      <MembersManager spaceId={id} members={members} currentUserId={session.user.id} />

      {!space.isPersonal ? (
        <Card style={{ borderColor: "color-mix(in oklch, oklch(0.62 0.2 25) 40%, var(--border))" }}>
          <h2 style={{ margin: 0, fontWeight: 600, color: "oklch(0.62 0.2 25)" }}>Danger zone</h2>
          <p className="muted" style={{ margin: "4px 0 12px", fontSize: 13 }}>
            Deleting a space permanently removes all of its documents.
          </p>
          <form action={deleteSpaceAction}>
            <input type="hidden" name="spaceId" value={id} />
            <Button variant="danger" type="submit">Delete this space</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
