import Link from "next/link";
import { auth } from "@/auth";
import { Card } from "@/components/ui";

export default async function DashboardPage() {
  const session = await auth();
  return (
    <div className="wrap fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome{session?.user?.name ? `, ${session.user.name}` : ""}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your AI Brain is ready. Documents and the editor arrive in Phase 3.
        </p>
      </div>
      <Card className="space-y-2">
        <h2 className="font-semibold">Connect your tooling</h2>
        <p className="text-sm text-gray-500">
          Generate a Personal Access Token to let Claude, Codex, or scripts read and write your
          brain over REST and MCP.
        </p>
        <Link href="/settings/tokens" className="text-sm font-medium text-brand-600 hover:underline">
          Manage tokens →
        </Link>
      </Card>
    </div>
  );
}
