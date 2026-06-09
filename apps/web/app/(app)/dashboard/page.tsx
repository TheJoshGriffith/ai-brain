import Link from "next/link";
import { auth } from "@/auth";
import { Card } from "@/components/ui";

export default async function DashboardPage() {
  const session = await auth();
  return (
    <div className="wrap fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Welcome{session?.user?.name ? `, ${session.user.name}` : ""}</h1>
          <p className="page-sub">Your AI Brain is ready — browse the knowledge base, search, and connect agents.</p>
        </div>
      </div>
      <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>Connect your tooling</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Generate a Personal Access Token to let Claude, Codex, or scripts read and write your
          brain over REST and MCP.
        </p>
        <Link href="/settings/tokens" className="link-accent" style={{ fontSize: 13, fontWeight: 500 }}>
          Manage tokens →
        </Link>
      </Card>
    </div>
  );
}
