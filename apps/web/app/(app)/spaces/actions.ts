"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SpaceError, type SpaceRole } from "@ai-brain/core";
import { auth } from "@/auth";
import { spaceService } from "@/lib/services";
import { CURRENT_SPACE_COOKIE } from "@/lib/current-space";

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user.id;
}

async function setCurrentSpace(spaceId: string) {
  (await cookies()).set(CURRENT_SPACE_COOKIE, spaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function switchSpaceAction(spaceId: string) {
  await requireUser();
  await setCurrentSpace(spaceId);
  revalidatePath("/", "layout");
  redirect("/documents");
}

export interface SpaceFormState {
  error?: string;
}

export async function createSpaceAction(_prev: SpaceFormState, formData: FormData): Promise<SpaceFormState> {
  const userId = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  let spaceId: string;
  try {
    spaceId = (await spaceService().create(userId, { name })).id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create space" };
  }
  await setCurrentSpace(spaceId);
  revalidatePath("/", "layout");
  redirect("/documents");
}

export async function addMemberAction(spaceId: string, _prev: SpaceFormState, formData: FormData): Promise<SpaceFormState> {
  const userId = await requireUser();
  try {
    await spaceService().addMember(userId, spaceId, {
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "viewer") as SpaceRole,
    });
  } catch (error) {
    if (error instanceof SpaceError) return { error: error.message };
    return { error: "Failed to add member" };
  }
  revalidatePath(`/spaces/${spaceId}/settings`);
  return {};
}

export async function updateMemberRoleAction(formData: FormData) {
  const userId = await requireUser();
  const spaceId = String(formData.get("spaceId"));
  const targetUserId = String(formData.get("userId"));
  const role = String(formData.get("role")) as SpaceRole;
  await spaceService().updateMemberRole(userId, spaceId, targetUserId, role);
  revalidatePath(`/spaces/${spaceId}/settings`);
}

export async function removeMemberAction(formData: FormData) {
  const userId = await requireUser();
  const spaceId = String(formData.get("spaceId"));
  const targetUserId = String(formData.get("userId"));
  await spaceService().removeMember(userId, spaceId, targetUserId);
  revalidatePath(`/spaces/${spaceId}/settings`);
}

export async function deleteSpaceAction(formData: FormData) {
  const userId = await requireUser();
  const spaceId = String(formData.get("spaceId"));
  await spaceService().remove(userId, spaceId);
  (await cookies()).delete(CURRENT_SPACE_COOKIE);
  revalidatePath("/", "layout");
  redirect("/documents");
}
