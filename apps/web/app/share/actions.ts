"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sharingService } from "@/lib/services";

/** A logged-in visitor claims a share link's role, then opens the document. */
export async function claimShareAction(token: string) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/share/${token}`);
  const documentId = await sharingService().claimDocumentLink(session.user.id, token);
  redirect(documentId ? `/documents/${documentId}` : "/documents");
}
