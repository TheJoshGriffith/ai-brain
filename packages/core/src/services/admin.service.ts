import { desc, eq } from "drizzle-orm";
import {
  appSettings,
  invitations,
  users,
  type Database,
  type RegistrationMode,
} from "@ai-brain/db";
import type { Job } from "@ai-brain/db";
import { generateToken, hashToken } from "../auth/token";
import { config } from "../config";
import { AuthError } from "./auth.service";
import { EmailService } from "./email.service";
import { QueueService, type JobStats } from "./queue.service";

export interface AdminUserView {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: Date;
}

/** Instance administration — gated by users.is_admin. */
export class AdminService {
  private readonly email = new EmailService();
  private readonly queue: QueueService;
  constructor(private readonly db: Database) {
    this.queue = new QueueService(db);
  }

  private async requireAdmin(userId: string): Promise<void> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.isAdmin) throw new AuthError("Admin access required");
  }

  // --- Background jobs ------------------------------------------------------

  async jobStats(userId: string): Promise<JobStats> {
    await this.requireAdmin(userId);
    return this.queue.stats();
  }
  async failedJobs(userId: string): Promise<Job[]> {
    await this.requireAdmin(userId);
    return this.queue.listFailed();
  }
  async retryJob(userId: string, jobId: string): Promise<number> {
    await this.requireAdmin(userId);
    return this.queue.retry(jobId);
  }
  async retryAllFailedJobs(userId: string): Promise<number> {
    await this.requireAdmin(userId);
    return this.queue.retryAllFailed();
  }

  async setRegistrationMode(userId: string, mode: RegistrationMode): Promise<void> {
    await this.requireAdmin(userId);
    await this.db
      .insert(appSettings)
      .values({ id: "global", registrationMode: mode })
      .onConflictDoUpdate({ target: appSettings.id, set: { registrationMode: mode, updatedAt: new Date() } });
  }

  async listUsers(userId: string): Promise<AdminUserView[]> {
    await this.requireAdmin(userId);
    const rows = await this.db
      .select({ id: users.id, email: users.email, name: users.name, isAdmin: users.isAdmin, emailVerified: users.emailVerified, createdAt: users.createdAt })
      .from(users)
      .orderBy(desc(users.createdAt));
    return rows.map((r) => ({ ...r, emailVerified: r.emailVerified != null }));
  }

  async setUserAdmin(userId: string, targetUserId: string, isAdmin: boolean): Promise<void> {
    await this.requireAdmin(userId);
    await this.db.update(users).set({ isAdmin }).where(eq(users.id, targetUserId));
  }

  /** Create an invitation and email a registration link. */
  async createInvitation(userId: string, email: string): Promise<{ url: string }> {
    await this.requireAdmin(userId);
    const normalized = email.toLowerCase().trim();
    const raw = generateToken().raw;
    await this.db.insert(invitations).values({
      email: normalized,
      tokenHash: hashToken(raw),
      invitedBy: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const url = `${config.appUrl}/register?invite=${raw}&email=${encodeURIComponent(normalized)}`;
    await this.email.sendInvite(normalized, url);
    return { url };
  }
}
