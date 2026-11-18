import type { CourseLevel, CourseStatus, LessonType, QuestionType } from "../enums.js";
import type { PaginationMeta } from "./http.js";
export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  courseCount?: number;
}

export interface PublicCourseSummary {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  level: CourseLevel;
  language: string;
  price: number;
  ratingAverage: number;
  ratingCount: number;
  enrollmentCount: number;
  totalDurationMinutes: number;
  category?: { id: string; name: string; slug: string };
  instructor: { id: string; name: string; avatar?: string };
  publishedAt?: string;
}

export interface CourseList {
  items: PublicCourseSummary[];
  meta: PaginationMeta;
}

export interface PublicLesson {
  id: string;
  title: string;
  type: LessonType;
  durationMinutes: number;
  isFreePreview: boolean;
}

export interface PublicSection {
  id: string;
  title: string;
  order: number;
  lessons: PublicLesson[];
}

export interface PublicCourseDetail extends PublicCourseSummary {
  description: string;
  previewVideoUrl?: string;
  tags: string[];
  requirements: string[];
  learningOutcomes: string[];
  status: CourseStatus;
  sections: PublicSection[];
  instructor: { id: string; name: string; avatar?: string; bio: string };
}

/** Enriched lesson payload returned to enrolled students / instructors. */
export interface LessonDetail extends PublicLesson {
  videoUrl?: string;
  content?: string;
  fileUrl?: string;
  externalUrl?: string;
  attachments: { name: string; url: string }[];
}

export interface PublicEnrollment {
  id: string;
  status: "active" | "completed" | "cancelled";
  progressPercent: number;
  enrolledAt: string;
  completedAt?: string;
  course: {
    id: string;
    slug: string;
    title: string;
    thumbnail?: string;
    level: CourseLevel;
    totalDurationMinutes: number;
  } | null;
}

/** Aggregated lesson completion state for one user + course. */
export interface CourseProgress {
  courseId: string;
  status: "active" | "completed" | "cancelled";
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  completedLessonIds: string[];
  lastLessonId?: string;
  completedAt?: string;
}

/* -------------------------------- quizzes -------------------------------- */

/** One quiz per course (MVP); stored with grading data server-side only. */
export interface PublicQuiz {
  id: string;
  courseId: string;
  title: string;
  passScore: number;
  questions: PublicQuizQuestion[];
  hasQuiz: true;
}

/** Question shape handed to students — no correct answers included. */
export interface PublicQuizQuestion {
  id: string;
  text: string;
  type: QuestionType;
  points: number;
  options: { id: string; text: string }[];
}

/** Instructor view includes grading data. */
export interface InstructorQuiz extends Omit<PublicQuiz, "questions" | "hasQuiz"> {
  questions: (PublicQuizQuestion & { correctOptionIds: string[] })[];
  hasQuiz?: undefined;
}

export interface QuizAttemptResult {
  id: string;
  quizId: string;
  scorePercent: number;
  passed: boolean;
  passScore: number;
  totalPoints: number;
  earnedPoints: number;
  perQuestion: { questionId: string; correct: boolean }[];
  submittedAt: string;
}

export interface QuizAttemptSummary {
  id: string;
  scorePercent: number;
  passed: boolean;
  submittedAt: string;
}

/* ---------------------------- reviews ---------------------------- */

export interface PublicReview {
  id: string;
  rating: number;
  comment?: string;
  user: { id: string; name: string; avatar?: string };
  createdAt: string;
  updatedAt?: string;
  /** True when the request came from the review's author. */
  isMine?: boolean;
}

export interface ReviewList {
  items: PublicReview[];
  meta: PaginationMeta;
}

/* -------------------------- certificates -------------------------- */

export interface PublicCertificate {
  id: string;
  serial: string;
  issuedAt: string;
  /** Present when the course quiz was passed before issuance. */
  quizScorePercent?: number;
  learner: { id: string; name: string };
  course: {
    id: string;
    slug: string;
    title: string;
    instructorName: string;
  };
  /** Completion snapshot at issuance time. */
  lessonsCompleted: number;
  totalLessons: number;
}
