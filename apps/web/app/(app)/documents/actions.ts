"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { documentService, tagService } from "@/lib/services";
import { getSpacesAndCurrent } from "@/lib/current-space";

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user.id;
}

export async function createDocumentAction() {
  const userId = await requireUser();
  const { current } = await getSpacesAndCurrent(userId);
  const doc = await documentService().create(userId, current.id, {
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

export async function setDocumentTagsAction(id: string, tags: string[]): Promise<string[]> {
  const userId = await requireUser();
  const set = await tagService().setDocumentTags(userId, id, tags);
  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
  return set;
}
