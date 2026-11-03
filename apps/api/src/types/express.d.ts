import type { UserRole } from "@lms/shared";

declare module "express-serve-static-core" {
  interface Request {
    /** Populated by `authenticate`. */
    user?: {
      id: string;
      role: UserRole;
      email: string;
    };
  }
}
