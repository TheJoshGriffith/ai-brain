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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Spaces</h1>
      <Card>
        <CreateSpaceForm />
      </Card>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {spaces.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">
                {s.name}
                {s.isPersonal ? <span className="ml-2 text-xs text-gray-400">personal</span> : null}
              </p>
              <p className="text-xs text-gray-400">your role: {s.role}</p>
            </div>
            <div className="flex items-center gap-2">
              {s.role === "owner" ? (
                <Link
                  href={`/spaces/${s.id}/settings`}
                  className="text-sm text-gray-500 hover:underline"
                >
                  Settings
                </Link>
              ) : null}
              <form action={switchSpaceAction.bind(null, s.id)}>
                <Button type="submit" variant="ghost">
                  Open
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
