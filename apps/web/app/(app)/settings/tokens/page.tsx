import { auth } from "@/auth";
import { tokenService } from "@/lib/services";
import { TokensClient } from "./tokens-client";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const session = await auth();
  const tokens = session?.user ? await tokenService().list(session.user.id) : [];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Personal Access Tokens</h1>
      <p className="text-sm text-gray-500">
        Tokens authenticate the REST API and MCP server. Treat them like passwords.
      </p>
      <div className="pt-4">
        <TokensClient tokens={tokens} />
      </div>
    </div>
  );
}
