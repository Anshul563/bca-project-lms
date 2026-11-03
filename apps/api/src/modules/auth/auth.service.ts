import {
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOGIN_LOCKOUT_MINUTES,
  type AuthSuccess,
  type LoginBody,
  type RegisterBody,
  type UpdateProfileBody,
} from "@lms/shared";
import { randomBytes } from "node:crypto";

import { ApiError } from "../../utils/ApiError.js";
import { generateOpaqueToken, hashOpaqueToken, hashPassword, verifyPassword } from "../../utils/crypto.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { buildPasswordResetEmail, buildVerificationEmail, sendEmail, type OutgoingEmail } from "../../utils/mailer.js";
import { InstructorApplicationModel } from "../users/instructorApplication.model.js";
import { UserModel, type UserDoc } from "../users/user.model.js";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const LOCKOUT_MS = LOGIN_LOCKOUT_MINUTES * 60 * 1000;
const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_STORED_REFRESH_SESSIONS = 5;

interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

export type SuccessResult = {
  user: AuthSuccess["user"];
  tokens: { accessToken: string; refreshToken?: string };
};

function toPublicUser(user: UserDoc, applicationStatus?: string): AuthSuccess["user"] {
  const json = user.toPublicJSON();
  return {
    ...json,
    ...(applicationStatus !== undefined && {
      hasInstructorApplication: true,
      instructorApplicationStatus: applicationStatus as "pending" | "approved" | "rejected",
    }),
  };
}

async function findApplicationStatus(userId: string): Promise<string | undefined> {
  const application = await InstructorApplicationModel.findOne({ user: userId }).lean();
  return application?.status;
}

/** Mint access + refresh tokens and persist the refresh session (newest-first, capped). */
async function issueTokens(user: UserDoc, meta: ClientMeta): Promise<{ accessToken: string; refreshToken: string }> {
  const userId = String(user._id);
  const accessToken = signAccessToken(userId, user.role);
  const refreshToken = signRefreshToken(userId, user.role, generateOpaqueToken());

  await UserModel.updateOne(
    { _id: user._id },
    {
      $push: {
        refreshSessions: {
          $each: [
            {
              tokenHash: hashOpaqueToken(refreshToken),
              expiresAt: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
              ...(meta.ip ? { ip: meta.ip } : {}),
              ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
            },
          ],
          $position: 0,
          $slice: MAX_STORED_REFRESH_SESSIONS,
        },
      },
    },
  );

  return { accessToken, refreshToken };
}

async function purgeExpiredSessions(userId: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    { $pull: { refreshSessions: { expiresAt: { $lt: new Date() } } } },
  );
}

export async function registerStudent(body: RegisterBody, meta: ClientMeta): Promise<SuccessResult> {
  const existing = await UserModel.exists({ email: body.email });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists", "EMAIL_TAKEN");
  }

  const verificationToken = randomBytes(32).toString("hex");
  const user = await UserModel.create({
    name: body.name,
    email: body.email,
    passwordHash: await hashPassword(body.password),
    role: "student",
    emailVerificationTokenHash: hashOpaqueToken(verificationToken),
    emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  });

  const currentUserId = String(user._id);
  const emailPayload: OutgoingEmail = {
    ...buildVerificationEmail(user.name, verificationToken),
    to: user.email,
  };
  void sendEmail(emailPayload);

  const tokens = await issueTokens(user, meta);
  return { user: toPublicUser(user), tokens };
}

export async function login(body: LoginBody, meta: ClientMeta): Promise<SuccessResult> {
  const user = await UserModel.findOne({ email: body.email }).select(
    "+passwordHash +failedLoginAttempts +lockoutUntil",
  );
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    const minutesLeft = Math.max(1, Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60_000));
    throw ApiError.tooManyRequests(
      `Account temporarily locked after repeated failed logins. Try again in ~${minutesLeft} minute(s).`,
      "ACCOUNT_LOCKED",
    );
  }

  const passwordOk = await verifyPassword(body.password, user.passwordHash);
  if (!passwordOk) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      user.lockoutUntil = new Date(Date.now() + LOCKOUT_MS);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw ApiError.unauthorized("Invalid email or password");
  }

  if (user.status === "suspended") {
    throw ApiError.forbidden("This account is suspended. Contact support.", "ACCOUNT_SUSPENDED");
  }

  user.failedLoginAttempts = 0;
  user.lockoutUntil = null;
  user.lastLoginAt = new Date();
  await purgeExpiredSessions(String(user._id));

  const tokens = await issueTokens(user, meta);
  await user.save();

  return { user: toPublicUser(user), tokens };
}

export async function refreshSession(refreshToken: string, meta: ClientMeta): Promise<SuccessResult> {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashOpaqueToken(refreshToken);
  const now = new Date();

  // The presented session must exist, unexpired, on a live active account.
  const account = await UserModel.exists({
    _id: payload.sub,
    status: "active",
    refreshSessions: { $elemMatch: { tokenHash, expiresAt: { $gt: now } } },
  });
  if (!account) {
    throw ApiError.unauthorized("Session is no longer valid", "SESSION_INVALID");
  }

  // Rotate: invalidate the presented token before minting its replacement.
  await UserModel.updateOne({ _id: payload.sub }, { $pull: { refreshSessions: { tokenHash } } });
  await purgeExpiredSessions(payload.sub);

  const user = await UserModel.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized("Session is no longer valid", "SESSION_INVALID");
  }
  const tokens = await issueTokens(user, meta);

  return { user: toPublicUser(user), tokens };
}

export async function logout(refreshToken: string | null): Promise<void> {
  if (!refreshToken) {
    return;
  }
  try {
    const payload = verifyRefreshToken(refreshToken);
    await UserModel.updateOne(
      { _id: payload.sub },
      { $pull: { refreshSessions: { tokenHash: hashOpaqueToken(refreshToken) } } },
    );
  } catch {
    // Expired/invalid tokens are fine — logout is idempotent.
  }
}

export async function getMe(userId: string): Promise<AuthSuccess["user"]> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw ApiError.unauthorized("Session user no longer exists", "SESSION_INVALID");
  }
  const applicationStatus = await findApplicationStatus(String(user._id));
  return toPublicUser(user, applicationStatus);
}

export async function updateProfile(userId: string, body: UpdateProfileBody): Promise<AuthSuccess["user"]> {
  const user = await UserModel.findByIdAndUpdate(
    userId,
    { $set: body },
    { new: true, runValidators: true },
  );
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  const applicationStatus = await findApplicationStatus(String(user._id));
  return toPublicUser(user, applicationStatus);
}

export async function verifyEmail(token: string): Promise<void> {
  const user = await UserModel.findOne({
    emailVerificationTokenHash: hashOpaqueToken(token),
    emailVerificationExpiresAt: { $gt: new Date() },
  });
  if (!user) {
    throw ApiError.badRequest("Verification link is invalid or has expired", "VERIFICATION_INVALID");
  }
  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await UserModel.findOne({ email });
  if (!user) {
    // Do not leak account existence.
    return;
  }
  const token = randomBytes(32).toString("hex");
  user.passwordResetTokenHash = hashOpaqueToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await user.save();

  const emailPayload: OutgoingEmail = { ...buildPasswordResetEmail(user.name, token), to: user.email };
  void sendEmail(emailPayload);
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const user = await UserModel.findOne({
    passwordResetTokenHash: hashOpaqueToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  });
  if (!user) {
    throw ApiError.badRequest("Reset link is invalid or has expired", "RESET_INVALID");
  }

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash: await hashPassword(password) },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1, refreshSessions: 1 },
    },
  );
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentRefreshToken: string | null,
): Promise<void> {
  const user = await UserModel.findById(userId).select("+passwordHash");
  if (!user) {
    throw ApiError.unauthorized();
  }
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw ApiError.badRequest("Current password is incorrect", "WRONG_PASSWORD");
  }

  // Keep only the caller's own session active (revoke every other device).
  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash: await hashPassword(newPassword) },
      ...(currentRefreshToken
        ? { $pull: { refreshSessions: { tokenHash: { $ne: hashOpaqueToken(currentRefreshToken) } } } }
        : { $set: { refreshSessions: [] } }),
    },
  );
}

export async function applyForInstructor(userId: string, bio: string, website?: string): Promise<string> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw ApiError.unauthorized();
  }
  if (user.role !== "student") {
    throw ApiError.conflict("Only student accounts can apply to become instructors", "NOT_APPLICABLE");
  }
  const existing = await InstructorApplicationModel.findOne({ user: user._id });
  if (existing && existing.status !== "rejected") {
    throw ApiError.conflict(
      existing.status === "pending"
        ? "You already have a pending application"
        : "You are already approved as an instructor",
      "APPLICATION_EXISTS",
    );
  }

  const application =
    existing ?? (await InstructorApplicationModel.create({ user: user._id, bio, website }));
  if (existing) {
    // Re-submission after a rejection replaces the pending data.
    application.bio = bio;
    application.website = website;
    application.status = "pending";
    await application.save();
  }
  return "pending";
}
