import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-medium text-brand-600">Self-hosted · AI-native</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">AI Brain</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          A Markdown knowledge base your tools can think with. Documents and the links
          between them live in Postgres, reachable over REST and MCP so Claude and Codex
          can read, write, and search your brain.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/register"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Sign in
          </Link>
        </div>
      </div>
      <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
        <li>✓ Phase 1 — monorepo, Next.js + Tailwind, Postgres + pgvector</li>
        <li>· Phase 2 — login &amp; personal access tokens</li>
        <li>· Phase 3 — documents &amp; editor</li>
        <li>· Phase 4 — wiki-links &amp; backlinks</li>
        <li>· Phase 5 — hybrid full-text + semantic search</li>
        <li>· Phase 6 — MCP server</li>
      </ul>
    </main>
  );
}
