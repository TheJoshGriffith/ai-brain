import Link from "next/link";
import { auth } from "@/auth";
import { documentService, sharingService } from "@/lib/services";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button, Card } from "@/components/ui";
import { claimShareAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const grant = await sharingService().resolveToken(token);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
  );

  if (!grant || grant.resourceType !== "document") {
    return (
      <Shell>
        <Card>
          <h1 className="text-lg font-semibold">This link isn’t valid</h1>
          <p className="hint mt-1">It may have been revoked or expired.</p>
        </Card>
      </Shell>
    );
  }

  const session = await auth();

  // Login-required link, viewer not signed in.
  if (!grant.allowAnonymous && !session?.user) {
    return (
      <Shell>
        <Card>
          <h1 className="text-lg font-semibold">Sign in to view this document</h1>
          <p className="hint mt-1">The owner restricted this link to signed-in users.</p>
          <Link
            href={`/login?callbackUrl=/share/${token}`}
            className="btn btn-primary" style={{ marginTop: 16 }}
          >
            Sign in
          </Link>
        </Card>
      </Shell>
    );
  }

  const doc = await documentService().getByIdUnscoped(grant.resourceId);
  if (!doc) {
    return (
      <Shell>
        <Card><h1 className="text-lg font-semibold">Document not found</h1></Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <span className="hint">Shared document · {grant.role} access</span>
        {session?.user ? (
          <form action={claimShareAction.bind(null, token)}>
            <Button type="submit" variant="ghost">
              {grant.role === "viewer" ? "Save to my workspace" : "Open in editor"}
            </Button>
          </form>
        ) : null}
      </div>
      <h1 className="mb-4 text-3xl font-bold">{doc.title}</h1>
      <article className="card">
        <MarkdownPreview content={doc.content} />
      </article>
    </Shell>
  );
}
