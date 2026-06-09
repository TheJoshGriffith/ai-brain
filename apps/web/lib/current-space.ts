import "server-only";
import { cookies } from "next/headers";
import type { SpaceWithRole } from "@ai-brain/core";
import { spaceService } from "./services";

export const CURRENT_SPACE_COOKIE = "currentSpaceId";

/**
 * Resolves the user's spaces and their "current" one (from the cookie, falling
 * back to their Personal space). Guarantees a Personal space exists.
 */
export async function getSpacesAndCurrent(
  userId: string,
): Promise<{ spaces: SpaceWithRole[]; current: SpaceWithRole }> {
  const svc = spaceService();
  let spaces = await svc.list(userId);
  if (spaces.length === 0) {
    await svc.ensurePersonalSpace(userId);
    spaces = await svc.list(userId);
  }

  const wanted = (await cookies()).get(CURRENT_SPACE_COOKIE)?.value;
  const current =
    spaces.find((s) => s.id === wanted) ??
    spaces.find((s) => s.isPersonal) ??
    spaces[0]!;
  return { spaces, current };
}
