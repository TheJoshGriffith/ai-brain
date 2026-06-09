import { auth } from "@/auth";
import { tokenService } from "@/lib/services";
import { AppearanceControls } from "@/components/appearance-controls";
import { TokensClient } from "./tokens-client";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const session = await auth();
  const tokens = session?.user ? await tokenService().list(session.user.id) : [];

  return (
    <div className="wrap fade-in space-y-2">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Appearance and access tokens for the REST API + MCP server.</p>
        </div>
      </div>
      <AppearanceControls />
      <h2 className="page-title" style={{ fontSize: 16, marginTop: 8 }}>Personal Access Tokens</h2>
      <p className="page-sub">Tokens authenticate the REST API and MCP server. Treat them like passwords.</p>
      <div className="pt-4">
        <TokensClient tokens={tokens} />
      </div>
    </div>
  );
}
