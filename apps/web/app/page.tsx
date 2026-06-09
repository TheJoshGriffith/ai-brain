import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>Self-hosted · AI-native</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">AI Brain</h1>
        <p className="mt-4 muted" style={{ fontSize: 18, lineHeight: 1.6 }}>
          A Markdown knowledge base your tools can think with. Documents and the links
          between them live in Postgres, reachable over REST and MCP so Claude and Codex
          can read, write, and search your brain.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/register" className="btn btn-primary">Get started</Link>
          <Link href="/login" className="btn">Sign in</Link>
        </div>
      </div>
      <ul className="hint" style={{ display: "flex", flexDirection: "column", gap: 6, listStyle: "none", padding: 0, margin: 0 }}>
        <li>Spaces &amp; shared workspaces with role-based access</li>
        <li>Wiki-links, backlinks, tags &amp; comments</li>
        <li>Hybrid full-text + semantic search (⌘K)</li>
        <li>Public share links &amp; per-document access</li>
        <li>Built-in MCP server for Claude &amp; Codex</li>
      </ul>
    </main>
  );
}
