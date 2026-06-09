import Link from "next/link";
import type { BacklinkRef } from "@ai-brain/core";

export function BacklinksPanel({ backlinks }: { backlinks: BacklinkRef[] }) {
  return (
    <div className="meta-block">
      <h5>Backlinks {backlinks.length > 0 ? `(${backlinks.length})` : ""}</h5>
      {backlinks.length === 0 ? (
        <p className="hint">No documents link here yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {backlinks.map((b) => (
            <Link key={b.documentId} href={`/documents/${b.documentId}`} className="link-accent" style={{ fontSize: 13 }}>
              {b.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
