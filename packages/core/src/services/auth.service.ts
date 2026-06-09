import { eq, sql } from "drizzle-orm";
import {
  appSettings,
  invitations,
  passwordResetTokens,
  users,
  verificationTokens,
  type Database,
  type RegistrationMode,
  type User,
} from "@ai-brain/db";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../auth/password";
import { generateToken, hashToken } from "../auth/token";
import { config } from "../config";
import { loginLimiter, passwordResetLimiter } from "../rate-limit";
import { EmailService } from "./email.service";
import { SpaceService } from "./space.service";

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).max(120).optional(),
  inviteToken: z.string().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export class AuthError extends Error {}

const HOUR = 60 * 60 * 1000;

export class AuthService {
  private readonly email = new EmailService();
  constructor(private readonly db: Database) {}

  async getRegistrationMode(): Promise<RegistrationMode> {
    const row = await this.db.query.appSettings.findFirst();
    return row?.registrationMode ?? "open";
  }

  async register(input: RegisterInput): Promise<User> {
    const { email, password, name, inviteToken } = registerSchema.parse(input);

    const existing = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) throw new AuthError("An account with that email already exists");

    const counted = await this.db.select({ count: sql<number>`count(*)::int` }).from(users);
    const isFirstUser = (counted[0]?.count ?? 0) === 0;

    // The first user bootstraps the instance; everyone after obeys the mode.
    if (!isFirstUser) {
      const mode = await this.getRegistrationMode();
      if (mode === "closed") throw new AuthError("Registration is disabled");
      if (mode === "invite") await this.consumeInvitation(email, inviteToken);
    }

    const passwordHash = await hashPassword(password);
    const [user] = await this.db
      .insert(users)
      .values({ email, name: name ?? null, passwordHash, isAdmin: isFirstUser })
      .returning();
    if (!user) throw new AuthError("Failed to create user");

    await new SpaceService(this.db).ensurePersonalSpace(user.id);
    await this.sendVerificationEmail(email);
    return user;
  }

  /** Returns the user if credentials valid (and email verified when required). */
  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    // Throttle brute-force: too many recent failures for this email → reject.
    if (loginLimiter.isLimited(normalized)) return null;

    const user = await this.db.query.users.findFirst({ where: eq(users.email, normalized) });
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      loginLimiter.record(normalized);
      return null;
    }
    if (config.requireEmailVerification && !user.emailVerified) return null;
    loginLimiter.reset(normalized);
    return user;
  }

  getUserById(id: string): Promise<User | undefined> {
    return this.db.query.users.findFirst({ where: eq(users.id, id) });
  }

  // --- Email verification --------------------------------------------------

  private async sendVerificationEmail(email: string): Promise<void> {
    const token = generateToken().raw;
    await this.db.insert(verificationTokens).values({ identifier: email, token, expires: new Date(Date.now() + 24 * HOUR) });
    await this.email.sendVerification(email, `${config.appUrl}/verify/${token}`);
  }

  async verifyEmail(token: string): Promise<boolean> {
    const row = await this.db.query.verificationTokens.findFirst({ where: eq(verificationTokens.token, token) });
    if (!row || row.expires.getTime() < Date.now()) return false;
    await this.db.update(users).set({ emailVerified: new Date() }).where(eq(users.email, row.identifier));
    await this.db.delete(verificationTokens).where(eq(verificationTokens.token, token));
    return true;
  }

  // --- Password reset ------------------------------------------------------

  /** Always resolves (does not reveal whether the email exists). */
  async requestPasswordReset(email: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    if (!passwordResetLimiter.consume(normalized)) return; // silently throttle
    const user = await this.db.query.users.findFirst({ where: eq(users.email, normalized) });
    if (!user) return;
    const raw = generateToken().raw;
    await this.db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + HOUR) });
    await this.email.sendPasswordReset(normalized, `${config.appUrl}/reset/${raw}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw new AuthError("Password must be at least 8 characters");
    const row = await this.db.query.passwordResetTokens.findFirst({ where: eq(passwordResetTokens.tokenHash, hashToken(token)) });
    if (!row || row.expiresAt.getTime() < Date.now()) throw new AuthError("Invalid or expired reset link");
    await this.db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, row.userId));
    await this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, row.userId));
  }

  // --- Invitations ---------------------------------------------------------

  private async consumeInvitation(email: string, inviteToken: string | undefined): Promise<void> {
    if (!inviteToken) throw new AuthError("An invitation is required to register");
    const inv = await this.db.query.invitations.findFirst({ where: eq(invitations.tokenHash, hashToken(inviteToken)) });
    if (!inv || inv.acceptedAt || inv.email !== email || inv.expiresAt.getTime() < Date.now()) {
      throw new AuthError("Invalid or expired invitation");
    }
    await this.db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
  }
}
