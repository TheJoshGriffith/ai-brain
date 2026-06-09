import type { SpaceRole } from "@ai-brain/db";

/** Privilege ordering, lowest → highest. */
export const ROLE_RANK: Record<SpaceRole, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  owner: 3,
};

/** Returns the more privileged of two (possibly absent) roles, or null. */
export function maxRole(a: SpaceRole | null | undefined, b: SpaceRole | null | undefined): SpaceRole | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

export const canRead = (role: SpaceRole | null | undefined): boolean => role != null;
export const canComment = (role: SpaceRole | null | undefined): boolean =>
  role != null && ROLE_RANK[role] >= ROLE_RANK.commenter;
export const canWrite = (role: SpaceRole | null | undefined): boolean =>
  role != null && ROLE_RANK[role] >= ROLE_RANK.editor;
export const canManage = (role: SpaceRole | null | undefined): boolean => role === "owner";
