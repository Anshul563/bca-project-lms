import { randomBytes } from "node:crypto";

import type { PublicCertificate } from "@lms/shared";
import type { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import { LessonModel } from "../courses/lesson.model.js";
import { EnrollmentModel } from "../enrollments/enrollment.model.js";
import { LessonProgressModel } from "../progress/progress.model.js";
import { QuizAttemptModel, QuizModel } from "../quizzes/quiz.model.js";
import { CertificateModel } from "./certificate.model.js";

interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
}

interface PopulatedCourse {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  instructor?: { name: string } | null;
}

function generateSerial(): string {
  const year = new Date().getFullYear();
  return `LMS-${year}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function toPublicCertificate(certificate: {
  _id: Types.ObjectId;
  serial: string;
  issuedAt: Date;
  quizScorePercent?: number;
  lessonsCompleted: number;
  totalLessons: number;
  user: PopulatedUser;
  course: PopulatedCourse;
}): PublicCertificate {
  return {
    id: String(certificate._id),
    serial: certificate.serial,
    issuedAt: certificate.issuedAt.toISOString(),
    ...(certificate.quizScorePercent !== undefined
      ? { quizScorePercent: certificate.quizScorePercent }
      : {}),
    learner: { id: String(certificate.user._id), name: certificate.user.name },
    course: {
      id: String(certificate.course._id),
      slug: certificate.course.slug,
      title: certificate.course.title,
      instructorName: certificate.course.instructor?.name ?? "Instructor",
    },
    lessonsCompleted: certificate.lessonsCompleted,
    totalLessons: certificate.totalLessons,
  };
}

/**
 * Issues the learner's certificate when they're eligible and it doesn't
 * already exist. Eligibility: enrollment completed AND — when the course has
 * a quiz — at least one passed attempt. Called from lesson completion and
 * quiz submission, so either path can finish the journey. Idempotent.
 */
export async function issueCertificateIfEligible(
  userId: string,
  courseId: string,
): Promise<void> {
  const enrollment = await EnrollmentModel.findOne({ user: userId, course: courseId });
  if (!enrollment || enrollment.status !== "completed") {
    return;
  }

  const existing = await CertificateModel.exists({ user: userId, course: courseId });
  if (existing) {
    return;
  }

  let quizScorePercent: number | undefined;
  const quiz = await QuizModel.findOne({ course: courseId }).select("_id");
  if (quiz) {
    const passedAttempt = await QuizAttemptModel.findOne({ user: userId, quiz: quiz._id, passed: true })
      .sort({ submittedAt: -1 })
      .select("scorePercent")
      .lean();
    if (!passedAttempt) {
      return; // lessons done, quiz still pending
    }
    quizScorePercent = passedAttempt.scorePercent;
  }

  const [totalLessons, lessonsCompleted] = await Promise.all([
    LessonModel.countDocuments({ course: courseId }),
    LessonProgressModel.countDocuments({ user: userId, course: courseId }),
  ]);

  // Serial collisions are astronomically unlikely; retry once just in case.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await CertificateModel.create({
        user: userId,
        course: courseId,
        serial: generateSerial(),
        issuedAt: new Date(),
        ...(quizScorePercent !== undefined ? { quizScorePercent } : {}),
        lessonsCompleted,
        totalLessons,
      });
      return;
    } catch (error) {
      const isDuplicate =
        typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;
      if (!isDuplicate || attempt === 1) {
        throw error;
      }
    }
  }
}

const CERT_POPULATE = [
  { path: "user", select: "name" },
  { path: "course", select: "slug title instructor", populate: { path: "instructor", select: "name" } },
] as const;

export async function listMyCertificates(userId: string): Promise<PublicCertificate[]> {
  const certificates = await CertificateModel.find({ user: userId })
    .sort({ issuedAt: -1 })
    .populate(CERT_POPULATE as never)
    .lean();
  return (certificates as unknown as Parameters<typeof toPublicCertificate>[0][]).map(toPublicCertificate);
}

/** Public verification endpoint — anyone can validate a certificate serial. */
export async function getCertificateBySerial(serial: string): Promise<PublicCertificate> {
  const certificate = await CertificateModel.findOne({ serial: serial.toUpperCase() })
    .populate(CERT_POPULATE as never)
    .lean();
  if (!certificate) {
    throw ApiError.notFound("Certificate not found");
  }
  return toPublicCertificate(certificate as unknown as Parameters<typeof toPublicCertificate>[0]);
}
