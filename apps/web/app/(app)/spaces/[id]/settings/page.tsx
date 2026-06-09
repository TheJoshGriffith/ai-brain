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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{space.name}</h1>
        <p className="text-sm text-gray-400">Manage members and access.</p>
      </div>

      <MembersManager spaceId={id} members={members} currentUserId={session.user.id} />

      {!space.isPersonal ? (
        <Card className="border-red-300/50">
          <h2 className="font-semibold text-red-600">Danger zone</h2>
          <p className="mb-3 mt-1 text-sm text-gray-500">
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
