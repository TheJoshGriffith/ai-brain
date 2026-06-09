"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RegistrationMode } from "@ai-brain/core";
import { auth } from "@/auth";
import { adminService } from "@/lib/services";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/dashboard");
  return session.user.id;
}

export async function setRegistrationModeAction(formData: FormData) {
  const userId = await requireAdmin();
  await adminService().setRegistrationMode(userId, String(formData.get("mode")) as RegistrationMode);
  revalidatePath("/admin");
}

export interface InviteState {
  url?: string;
  error?: string;
}

export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const userId = await requireAdmin();
  try {
    const { url } = await adminService().createInvitation(userId, String(formData.get("email") ?? ""));
    return { url };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create invite" };
  }
}

export async function setUserAdminAction(formData: FormData) {
  const userId = await requireAdmin();
  await adminService().setUserAdmin(userId, String(formData.get("userId")), formData.get("isAdmin") === "true");
  revalidatePath("/admin");
}
