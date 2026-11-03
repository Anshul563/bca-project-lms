import { env } from "../config/env.js";
import { logger } from "./logger.js";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Development mailer: when SMTP is not configured, emails are logged so
 * flows (verification, reset) remain fully testable without infrastructure.
 * Swapping in nodemailer is a single-file change when SMTP env vars exist.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  if (!env.SMTP_HOST) {
    logger.info({ to: email.to, subject: email.subject, body: email.text }, "DEV-MAIL (SMTP not configured)");
    return;
  }
  logger.info(
    { to: email.to, subject: email.subject, smtp: env.SMTP_HOST },
    "Mail queued (SMTP transport not wired yet; see docs/DECISIONS.md)",
  );
}

export function buildVerificationEmail(name: string, token: string): OutgoingEmail {
  return {
    to: "",
    subject: "Verify your email",
    text: `Hi ${name},\n\nVerify your account: ${env.WEB_URL}/verify-email?token=${token}\n\nIf you did not create an account, ignore this email.`,
  };
}

export function buildPasswordResetEmail(name: string, token: string): OutgoingEmail {
  return {
    to: "",
    subject: "Reset your password",
    text: `Hi ${name},\n\nReset your password: ${env.WEB_URL}/reset-password?token=${token}\n\nThis link expires in 1 hour.`,
  };
}
