import Link from "next/link";
import { auth } from "@/auth";
import { documentService } from "@/lib/services";
import { Button } from "@/components/ui";
import { createDocumentAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await auth();
  const docs = session?.user ? await documentService().list(session.user.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <form action={createDocumentAction}>
          <Button type="submit">New document</Button>
        </form>
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
