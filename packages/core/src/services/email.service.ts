import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config";

/**
 * Transactional email. Uses SMTP when configured (SMTP_HOST…), otherwise falls
 * back to a console transport that logs the message + link so dev works without
 * a mail server.
 */
export class EmailService {
  private transport: Transporter | null = null;

  private getTransport(): Transporter | null {
    if (this.transport) return this.transport;
    const smtp = config.smtp;
    if (!smtp) return null;
    this.transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
    return this.transport;
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    const transport = this.getTransport();
    if (!transport) {
      console.error(`\n[email] (no SMTP configured) To: ${to}\n[email] ${subject}\n[email] ${text}\n`);
      return;
    }
    await transport.sendMail({ from: config.emailFrom, to, subject, text });
  }

  sendPasswordReset(to: string, url: string): Promise<void> {
    return this.send(to, "Reset your AI Brain password", `Reset your password:\n\n${url}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`);
  }

  sendVerification(to: string, url: string): Promise<void> {
    return this.send(to, "Verify your AI Brain email", `Confirm your email address:\n\n${url}`);
  }

  sendInvite(to: string, url: string): Promise<void> {
    return this.send(to, "You're invited to AI Brain", `You've been invited. Create your account:\n\n${url}`);
  }
}
