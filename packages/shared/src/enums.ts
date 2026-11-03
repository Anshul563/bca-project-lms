/**
 * Domain enums. `as const` objects (not TS enums) so both runtime values and
 * literal union types are available to web and api.
 */

export const USER_ROLES = {
  Student: "student",
  Instructor: "instructor",
  Admin: "admin",
} as const;
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ACCOUNT_STATUSES = {
  Active: "active",
  Suspended: "suspended",
} as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[keyof typeof ACCOUNT_STATUSES];

/** Status of an instructor application awaiting admin approval. */
export const INSTRUCTOR_APPLICATION_STATUSES = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
} as const;
export type InstructorApplicationStatus =
  (typeof INSTRUCTOR_APPLICATION_STATUSES)[keyof typeof INSTRUCTOR_APPLICATION_STATUSES];

export const COURSE_STATUSES = {
  Draft: "draft",
  PendingReview: "pending_review",
  Published: "published",
  Archived: "archived",
} as const;
export type CourseStatus = (typeof COURSE_STATUSES)[keyof typeof COURSE_STATUSES];

export const COURSE_LEVELS = {
  Beginner: "beginner",
  Intermediate: "intermediate",
  Advanced: "advanced",
  AllLevels: "all_levels",
} as const;
export type CourseLevel = (typeof COURSE_LEVELS)[keyof typeof COURSE_LEVELS];

export const LESSON_TYPES = {
  Video: "video",
  Article: "article",
  Pdf: "pdf",
  Link: "link",
} as const;
export type LessonType = (typeof LESSON_TYPES)[keyof typeof LESSON_TYPES];

export const QUESTION_TYPES = {
  SingleChoice: "single_choice",
  MultipleChoice: "multiple_choice",
  TrueFalse: "true_false",
  ShortAnswer: "short_answer",
} as const;
export type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES];

export const ENROLLMENT_STATUSES = {
  Active: "active",
  Completed: "completed",
  Cancelled: "cancelled",
} as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[keyof typeof ENROLLMENT_STATUSES];

export const ORDER_STATUSES = {
  Pending: "pending",
  Paid: "paid",
  Failed: "failed",
  Refunded: "refunded",
} as const;
export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export const REVIEW_STATUSES = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
} as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[keyof typeof REVIEW_STATUSES];

export const NOTIFICATION_TYPES = {
  Enrollment: "enrollment",
  CourseReview: "course_review",
  CourseApproved: "course_approved",
  CourseRejected: "course_rejected",
  CertificateIssued: "certificate_issued",
  InstructorApproved: "instructor_approved",
  InstructorRejected: "instructor_rejected",
  NewQuizAttempt: "new_quiz_attempt",
  System: "system",
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
