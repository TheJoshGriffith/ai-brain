import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { linkService } from "@/lib/services";

/**
 * Resolves a clicked `[[wiki link]]` to its document and redirects there.
 * Unresolved targets fall back to the documents list with a hint.
 */
export default async function LinkResolverPage({
  params,
}: {
  params: Promise<{ raw: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { raw } = await params;
  const target = decodeURIComponent(raw);
  const id = await linkService().resolveTarget(session.user.id, target);
  redirect(id ? `/documents/${id}` : `/documents?missing=${encodeURIComponent(target)}`);
}
