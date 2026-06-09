import Link from "next/link";
import type { BacklinkRef } from "@ai-brain/core";

export function BacklinksPanel({ backlinks }: { backlinks: BacklinkRef[] }) {
  return (
    <section className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
      <h2 className="mb-2 text-sm font-semibold text-gray-500">
        Backlinks {backlinks.length > 0 ? `(${backlinks.length})` : ""}
      </h2>
      {backlinks.length === 0 ? (
        <p className="text-sm text-gray-400">
          No documents link here yet. Reference this note with{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">[[{`title`}]]</code>{" "}
          from another document.
        </p>
      ) : (
        <ul className="space-y-1">
          {backlinks.map((b) => (
            <li key={b.documentId}>
              <Link
                href={`/documents/${b.documentId}`}
                className="text-sm text-brand-600 hover:underline"
              >
                {b.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
