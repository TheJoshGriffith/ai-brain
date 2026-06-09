"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sharingService } from "@/lib/services";

type ShareRole = "viewer" | "commenter" | "editor";

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user.id;
}

export interface CreateLinkState {
  token?: string;
  error?: string;
}

export async function createShareLinkAction(
  documentId: string,
  _prev: CreateLinkState,
  formData: FormData,
): Promise<CreateLinkState> {
  const userId = await requireUser();
  try {
    const expiresRaw = String(formData.get("expiresAt") || "");
    const { token } = await sharingService().createDocumentLink(userId, documentId, {
      role: (String(formData.get("role")) || "viewer") as ShareRole,
      allowAnonymous: formData.get("allowAnonymous") === "on",
      expiresAt: expiresRaw ? new Date(expiresRaw) : undefined,
    });
    revalidatePath(`/documents/${documentId}`);
    return { token };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create link" };
  }
}

export async function revokeShareLinkAction(documentId: string, shareId: string) {
  const userId = await requireUser();
  await sharingService().revokeLink(userId, shareId);
  revalidatePath(`/documents/${documentId}`);
}

export interface AddMemberState {
  error?: string;
}

export async function addDocMemberAction(
  documentId: string,
  _prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const userId = await requireUser();
  try {
    await sharingService().addDocumentMember(userId, documentId, {
      email: String(formData.get("email") ?? ""),
      role: (String(formData.get("role")) || "viewer") as ShareRole,
    });
  } catch {
    return { error: "Could not add — check the email belongs to a registered user." };
  }
  revalidatePath(`/documents/${documentId}`);
  return {};
}

export async function removeDocMemberAction(documentId: string, targetUserId: string) {
  const userId = await requireUser();
  await sharingService().removeDocumentMember(userId, documentId, targetUserId);
  revalidatePath(`/documents/${documentId}`);
}
