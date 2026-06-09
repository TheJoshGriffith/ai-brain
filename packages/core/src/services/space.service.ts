import { and, desc, eq, like, ne } from "drizzle-orm";
import {
  spaceMembers,
  spaces,
  users,
  type Database,
  type Space,
  type SpaceRole,
} from "@ai-brain/db";
import { z } from "zod";
import { slugify } from "../markdown/parse";
import { AccessService } from "./access.service";

export const SPACE_ROLE_VALUES = ["viewer", "commenter", "editor", "owner"] as const;

export const createSpaceSchema = z.object({ name: z.string().trim().min(1).max(120) });
export const addMemberSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(SPACE_ROLE_VALUES),
});

export class SpaceError extends Error {}
export class SpaceForbiddenError extends SpaceError {
  constructor() {
    super("You do not have permission to manage this space");
  }
}

export type SpaceWithRole = Space & { role: SpaceRole };
export interface MemberView {
  userId: string;
  email: string;
  name: string | null;
  role: SpaceRole;
}

export class SpaceService {
  private readonly access: AccessService;
  constructor(private readonly db: Database) {
    this.access = new AccessService(db);
  }

  /** Idempotently ensures a user has a Personal space; returns it. */
  async ensurePersonalSpace(userId: string): Promise<Space> {
    const existing = await this.db.query.spaces.findFirst({
      where: and(eq(spaces.ownerId, userId), eq(spaces.isPersonal, true)),
    });
    if (existing) return existing;
    return this.insertSpace(userId, "Personal", true);
  }

  async create(userId: string, input: { name: string }): Promise<SpaceWithRole> {
    const { name } = createSpaceSchema.parse(input);
    const space = await this.insertSpace(userId, name, false);
    return { ...space, role: "owner" };
  }

  /** Spaces the user belongs to, with their role, most-recent first. */
  async list(userId: string): Promise<SpaceWithRole[]> {
    const rows = await this.db
      .select({ space: spaces, role: spaceMembers.role })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
      .where(eq(spaceMembers.userId, userId))
      .orderBy(desc(spaces.isPersonal), desc(spaces.createdAt));
    return rows.map((r) => ({ ...r.space, role: r.role }));
  }

  async get(userId: string, spaceId: string): Promise<SpaceWithRole | null> {
    const role = await this.access.resolveSpaceRole(userId, spaceId);
    if (!role) return null;
    const space = await this.db.query.spaces.findFirst({ where: eq(spaces.id, spaceId) });
    return space ? { ...space, role } : null;
  }

  async listMembers(userId: string, spaceId: string): Promise<MemberView[]> {
    if (!(await this.access.resolveSpaceRole(userId, spaceId))) throw new SpaceForbiddenError();
    const rows = await this.db
      .select({ userId: users.id, email: users.email, name: users.name, role: spaceMembers.role })
      .from(spaceMembers)
      .innerJoin(users, eq(users.id, spaceMembers.userId))
      .where(eq(spaceMembers.spaceId, spaceId))
      .orderBy(desc(spaceMembers.role));
    return rows;
  }

  /** Owner-only. Adds an existing user (matched by email) to the space. */
  async addMember(
    actorId: string,
    spaceId: string,
    input: { email: string; role: SpaceRole },
  ): Promise<MemberView> {
    await this.requireOwner(actorId, spaceId);
    const { email, role } = addMemberSchema.parse(input);

    const user = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) throw new SpaceError("No registered user with that email");

    await this.db
      .insert(spaceMembers)
      .values({ spaceId, userId: user.id, role })
      .onConflictDoUpdate({ target: [spaceMembers.spaceId, spaceMembers.userId], set: { role } });

    return { userId: user.id, email: user.email, name: user.name, role };
  }

  async updateMemberRole(actorId: string, spaceId: string, targetUserId: string, role: SpaceRole): Promise<void> {
    await this.requireOwner(actorId, spaceId);
    if (role !== "owner") await this.guardLastOwner(spaceId, targetUserId);
    await this.db
      .update(spaceMembers)
      .set({ role })
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, targetUserId)));
  }

  async removeMember(actorId: string, spaceId: string, targetUserId: string): Promise<void> {
    await this.requireOwner(actorId, spaceId);
    await this.guardLastOwner(spaceId, targetUserId);
    await this.db
      .delete(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, targetUserId)));
  }

  async remove(actorId: string, spaceId: string): Promise<void> {
    const space = await this.requireOwner(actorId, spaceId);
    if (space.isPersonal) throw new SpaceError("The Personal space cannot be deleted");
    await this.db.delete(spaces).where(eq(spaces.id, spaceId));
  }

  // --- helpers -------------------------------------------------------------

  private async insertSpace(ownerId: string, name: string, isPersonal: boolean): Promise<Space> {
    const slug = await this.uniqueSlug(ownerId, slugify(name));
    const space = await this.db.transaction(async (tx) => {
      const [s] = await tx
        .insert(spaces)
        .values({ ownerId, name, slug, isPersonal })
        .returning();
      if (!s) throw new SpaceError("Failed to create space");
      await tx.insert(spaceMembers).values({ spaceId: s.id, userId: ownerId, role: "owner" });
      return s;
    });
    return space;
  }

  private async requireOwner(userId: string, spaceId: string): Promise<Space> {
    const role = await this.access.resolveSpaceRole(userId, spaceId);
    if (role !== "owner") throw new SpaceForbiddenError();
    const space = await this.db.query.spaces.findFirst({ where: eq(spaces.id, spaceId) });
    if (!space) throw new SpaceError("Space not found");
    return space;
  }

  /** Prevents demoting/removing the last owner of a space. */
  private async guardLastOwner(spaceId: string, targetUserId: string): Promise<void> {
    const owners = await this.db
      .select({ userId: spaceMembers.userId })
      .from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.role, "owner")));
    if (owners.length <= 1 && owners.some((o) => o.userId === targetUserId)) {
      throw new SpaceError("A space must have at least one owner");
    }
  }

  private async uniqueSlug(ownerId: string, desired: string): Promise<string> {
    const taken = await this.db
      .select({ slug: spaces.slug })
      .from(spaces)
      .where(and(eq(spaces.ownerId, ownerId), like(spaces.slug, `${desired}%`), ne(spaces.slug, "")));
    const set = new Set(taken.map((r) => r.slug));
    if (!set.has(desired)) return desired;
    for (let i = 2; ; i++) if (!set.has(`${desired}-${i}`)) return `${desired}-${i}`;
  }
}
