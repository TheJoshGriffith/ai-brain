"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { documentService } from "@/lib/services";

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user.id;
}

export async function createDocumentAction() {
  const userId = await requireUser();
  const doc = await documentService().create(userId, {
    title: "Untitled",
    content: "# Untitled\n\n",
  });
  revalidatePath("/documents");
  redirect(`/documents/${doc.id}`);
}

export async function saveDocumentAction(
  id: string,
  patch: { title?: string; content?: string },
): Promise<{ title: string; slug: string; updatedAt: string }> {
  const userId = await requireUser();
  const doc = await documentService().update(userId, id, patch);
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { title: doc.title, slug: doc.slug, updatedAt: doc.updatedAt.toISOString() };
}

export async function deleteDocumentAction(id: string) {
  const userId = await requireUser();
  await documentService().remove(userId, id);
  revalidatePath("/documents");
  redirect("/documents");
}
