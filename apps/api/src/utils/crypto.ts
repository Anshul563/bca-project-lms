import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Cryptographically-strong URL-safe opaque token (kept for sessions). */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

/** One-way hash for storing opaque tokens at rest. */
export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
