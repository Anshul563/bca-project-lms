import mongoose, { type HydratedDocument, type Model } from "mongoose";
import type { AccountStatus, UserRole } from "@lms/shared";

/**
 * A stored refresh session. Access happens through targeted updateOne
 * queries only; hydrated documents never mutate this array directly.
 */
export interface RefreshSession {
  tokenHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
  createdAt?: Date;
}

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: AccountStatus;
  avatar?: string;
  bio?: string;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt?: Date;

  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  failedLoginAttempts: number;
  lockoutUntil: Date | null;
  refreshSessions?: RefreshSession[];
}

export interface IUserMethods {
  toPublicJSON(): {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: AccountStatus;
    avatar?: string;
    bio: string;
    emailVerified: boolean;
    lastLoginAt?: string;
    createdAt: string;
  };
}

export type UserDoc = HydratedDocument<IUser, IUserMethods>;

const refreshSessionSchema = new mongoose.Schema<RefreshSession>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    ip: { type: String },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["student", "instructor", "admin"], default: "student", index: true },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    avatar: { type: String },
    bio: { type: String, default: "" },
    emailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },

    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockoutUntil: { type: Date, default: null, select: false },

    refreshSessions: { type: [refreshSessionSchema], select: false, default: [] },
  },
  { timestamps: true },
);

userSchema.methods.toPublicJSON = function (this: UserDoc) {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    role: this.role,
    status: this.status,
    ...(this.avatar ? { avatar: this.avatar } : {}),
    bio: this.bio ?? "",
    emailVerified: this.emailVerified,
    ...(this.lastLoginAt ? { lastLoginAt: this.lastLoginAt.toISOString() } : {}),
    createdAt: this.createdAt.toISOString(),
  };
};

export type UserModelType = Model<IUser, Record<string, never>, IUserMethods>;

export const UserModel =
  (mongoose.models.User as UserModelType | undefined) ??
  mongoose.model<IUser, UserModelType>("User", userSchema);
