import { eq } from "drizzle-orm";
import { users, type Database, type User } from "@ai-brain/db";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../auth/password";
import { SpaceService } from "./space.service";

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export class AuthError extends Error {}

export class AuthService {
  constructor(private readonly db: Database) {}

  async register(input: RegisterInput): Promise<User> {
    const { email, password, name } = registerSchema.parse(input);

    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) throw new AuthError("An account with that email already exists");

    const passwordHash = await hashPassword(password);
    const [user] = await this.db
      .insert(users)
      .values({ email, name: name ?? null, passwordHash })
      .returning();
    if (!user) throw new AuthError("Failed to create user");

    // Every user gets a Personal space to land in.
    await new SpaceService(this.db).ensurePersonalSpace(user.id);
    return user;
  }

  /** Returns the user if email+password are valid, else null. */
  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, normalized),
    });
    if (!user?.passwordHash) return null;
    const ok = await verifyPassword(user.passwordHash, password);
    return ok ? user : null;
  }

  getUserById(id: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({ where: eq(users.id, id) });
  }
}
