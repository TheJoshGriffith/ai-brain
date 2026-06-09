"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { commentService } from "@/lib/services";

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user.id;
}

export interface CommentFormState {
  error?: string;
}

export async function addCommentAction(
  documentId: string,
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const userId = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Comment cannot be empty" };
  try {
    await commentService().add(userId, documentId, { body });
  } catch {
    return { error: "You don’t have permission to comment here." };
  }
  revalidatePath(`/documents/${documentId}`);
  return {};
}

export async function removeCommentAction(documentId: string, commentId: string) {
  const userId = await requireUser();
  await commentService().remove(userId, commentId);
  revalidatePath(`/documents/${documentId}`);
}
