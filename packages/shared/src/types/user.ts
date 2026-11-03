import type { AccountStatus, UserRole } from "../enums.js";

/** Safe user projection sent to clients (never passwordHash/tokens). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  avatar?: string;
  bio?: string;
  emailVerified: boolean;
  hasInstructorApplication?: boolean;
  instructorApplicationStatus?: "pending" | "approved" | "rejected";
  lastLoginAt?: string;
  createdAt: string;
}

/** Tokens returned by register/login/refresh. */
export interface TokenPair {
  accessToken: string;
  /** Sent as httpOnly cookie; exposed for non-browser clients/tests. */
  refreshToken?: string;
}

export interface AuthSuccess {
  user: PublicUser;
  tokens: TokenPair;
}
