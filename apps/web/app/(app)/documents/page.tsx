import Link from "next/link";
import { canWrite } from "@ai-brain/core";
import { auth } from "@/auth";
import { documentService } from "@/lib/services";
import { getSpacesAndCurrent } from "@/lib/current-space";
import { Button } from "@/components/ui";
import { createDocumentAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const { current } = await getSpacesAndCurrent(session.user.id);
  const docs = await documentService().list(session.user.id, current.id);
  const mayWrite = canWrite(current.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-gray-400">
            {current.name}
            {current.role !== "owner" ? ` · you are a ${current.role}` : ""}
          </p>
        </div>
        {mayWrite ? (
          <form action={createDocumentAction}>
            <Button type="submit">New document</Button>
          </form>
        ) : null}
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-gray-500">
          No documents yet. Create one, or have Claude/Codex write to your brain over the API.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/documents/${d.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.title}</span>
                  <span className="block truncate text-xs text-gray-400">/{d.slug}</span>
                </span>
                <time className="shrink-0 text-xs text-gray-400">
                  {new Date(d.updatedAt).toLocaleString()}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
