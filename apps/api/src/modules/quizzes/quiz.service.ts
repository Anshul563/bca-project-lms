import {
  type AttemptInput,
  type InstructorQuiz,
  type PublicQuiz,
  type QuizAttemptResult,
  type QuizAttemptSummary,
  type QuizInput,
} from "@lms/shared";
import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import { issueCertificateIfEligible } from "../certificates/certificate.service.js";
import { CourseModel } from "../courses/course.model.js";
import { EnrollmentModel } from "../enrollments/enrollment.model.js";
import { QuizAttemptModel, QuizModel, type IQuiz, type IQuizQuestion } from "./quiz.model.js";

export type ProgressRole = "student" | "instructor" | "admin";

async function requireCourse(courseId: string) {
  const course = await CourseModel.findOne({ _id: courseId, deletedAt: null });
  if (!course) {
    throw ApiError.notFound("Course not found");
  }
  return course;
}

async function requireEnrolled(userId: string, courseId: string): Promise<void> {
  const enrolled = await EnrollmentModel.exists({
    user: userId,
    course: courseId,
    status: { $in: ["active", "completed"] },
  });
  if (!enrolled) {
    throw ApiError.forbidden("Enroll in this course to take the quiz", "NOT_ENROLLED");
  }
}

/* ------------------------------ instructor ------------------------------ */

/** Creates or replaces the course's quiz (one per course in the MVP). */
export async function upsertQuiz(instructorId: string, role: ProgressRole, courseId: string, body: QuizInput): Promise<InstructorQuiz> {
  const course = await requireCourse(courseId);
  const isOwner = String(course.instructor) === instructorId;
  if (!isOwner && role !== "admin") {
    throw ApiError.forbidden("You can only manage quizzes for your own courses", "NOT_COURSE_OWNER");
  }

  // Convert authoring indexes into stable option ids for grading. Option ids
  // are generated up front so correctOptionIds can reference them directly
  // (no placeholder save needed).
  const questions = body.questions.map((question) => {
    if (question.correctOptionIndexes.some((index) => index >= question.options.length)) {
      throw ApiError.badRequest(
        `Question "${question.text.slice(0, 40)}" references an option index outside its options list`,
        "INVALID_OPTION_INDEX",
      );
    }
    const options = question.options.map((option) => ({
      _id: new Types.ObjectId(),
      text: option.text,
    }));
    return {
      text: question.text,
      type: question.type,
      points: question.points,
      options,
      correctOptionIds: question.correctOptionIndexes.map((index) => String(options[index]!._id)),
    };
  });

  const quiz = await QuizModel.findOneAndUpdate(
    { course: course._id },
    { $set: { title: body.title, passScore: body.passScore, questions } },
    { upsert: true, new: true, runValidators: true },
  );

  return toInstructorQuiz(quiz!);
}

export async function getQuizForInstructor(instructorId: string, role: ProgressRole, courseId: string): Promise<InstructorQuiz> {
  const course = await requireCourse(courseId);
  const isOwner = String(course.instructor) === instructorId;
  if (!isOwner && role !== "admin") {
    throw ApiError.forbidden("You can only view quizzes for your own courses", "NOT_COURSE_OWNER");
  }
  const quiz = await QuizModel.findOne({ course: course._id });
  if (!quiz) {
    throw ApiError.notFound("No quiz exists for this course yet");
  }
  return toInstructorQuiz(quiz);
}

export async function listAttemptsForInstructor(instructorId: string, role: ProgressRole, courseId: string): Promise<QuizAttemptSummary[]> {
  const course = await requireCourse(courseId);
  const isOwner = String(course.instructor) === instructorId;
  if (!isOwner && role !== "admin") {
    throw ApiError.forbidden("You can only view attempts for your own courses", "NOT_COURSE_OWNER");
  }
  const attempts = await QuizAttemptModel.find({ course: course._id }).sort({ submittedAt: -1 }).limit(100).lean();
  return attempts.map((attempt) => ({
    id: String(attempt._id),
    scorePercent: attempt.scorePercent,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt.toISOString(),
  }));
}

/* -------------------------------- student -------------------------------- */

function toPublicQuiz(quiz: IQuiz, courseId: string): PublicQuiz {
  return {
    id: String(quiz._id),
    courseId,
    title: quiz.title,
    passScore: quiz.passScore,
    hasQuiz: true,
    questions: quiz.questions.map((question) => ({
      id: String(question._id),
      text: question.text,
      type: question.type,
      points: question.points,
      options: question.options.map((option) => ({ id: String(option._id), text: option.text })),
    })),
  };
}

function toInstructorQuiz(quiz: IQuiz): InstructorQuiz {
  return {
    id: String(quiz._id),
    courseId: String(quiz.course),
    title: quiz.title,
    passScore: quiz.passScore,
    questions: quiz.questions.map((question) => ({
      id: String(question._id),
      text: question.text,
      type: question.type,
      points: question.points,
      options: question.options.map((option) => ({ id: String(option._id), text: option.text })),
      correctOptionIds: question.correctOptionIds,
    })),
  };
}

export async function getQuizForStudent(userId: string, role: ProgressRole, courseId: string): Promise<PublicQuiz> {
  const course = await requireCourse(courseId);
  if (role !== "admin" && String(course.instructor) !== userId) {
    await requireEnrolled(userId, courseId);
  }
  const quiz = await QuizModel.findOne({ course: course._id });
  if (!quiz) {
    throw ApiError.notFound("No quiz exists for this course yet");
  }
  // Correct answers never leave the server on this endpoint.
  return toPublicQuiz(quiz, courseId);
}

function isAnswerCorrect(question: IQuizQuestion, selected: string[]): boolean {
  const selectedSet = new Set(selected);
  const correctSet = new Set(question.correctOptionIds);
  if (selectedSet.size !== correctSet.size) {
    return false;
  }
  for (const id of correctSet) {
    if (!selectedSet.has(id)) {
      return false;
    }
  }
  return true;
}

export async function submitAttempt(
  userId: string,
  role: ProgressRole,
  courseId: string,
  body: AttemptInput,
): Promise<QuizAttemptResult> {
  const course = await requireCourse(courseId);
  if (role !== "admin" && String(course.instructor) !== userId) {
    await requireEnrolled(userId, courseId);
  }

  const quiz = await QuizModel.findOne({ course: course._id });
  if (!quiz) {
    throw ApiError.notFound("No quiz exists for this course yet");
  }

  const answerMap = new Map(body.answers.map((answer) => [answer.questionId, answer.selectedOptionIds]));
  const perQuestion: QuizAttemptResult["perQuestion"] = [];
  let earned = 0;
  let total = 0;

  for (const question of quiz.questions) {
    const selected = answerMap.get(String(question._id)) ?? [];
    const correct = isAnswerCorrect(question, selected);
    total += question.points;
    if (correct) {
      earned += question.points;
    }
    perQuestion.push({ questionId: String(question._id), correct });
  }

  // Unanswered questions count as incorrect: answers must cover the whole quiz
  // for a fair score, so reject submissions that skip questions entirely.
  const missing = quiz.questions.filter((question) => !answerMap.has(String(question._id)));
  if (missing.length === quiz.questions.length) {
    throw ApiError.badRequest("Submit answers for at least one question", "EMPTY_ATTEMPT");
  }

  const scorePercent = total === 0 ? 0 : Math.round((earned / total) * 100);
  const passed = scorePercent >= quiz.passScore;

  const attempt = await QuizAttemptModel.create({
    user: userId,
    quiz: quiz._id,
    course: course._id,
    answers: body.answers.map((answer) => ({
      questionId: new Types.ObjectId(answer.questionId),
      selectedOptionIds: answer.selectedOptionIds,
    })),
    scorePercent,
    earnedPoints: earned,
    totalPoints: total,
    passed,
    submittedAt: new Date(),
  });

  // Passing the quiz can be the last requirement for a certificate.
  if (passed) {
    await issueCertificateIfEligible(userId, courseId);
  }

  return {
    id: String(attempt._id),
    quizId: String(quiz._id),
    scorePercent,
    passed,
    passScore: quiz.passScore,
    totalPoints: total,
    earnedPoints: earned,
    perQuestion,
    submittedAt: attempt.submittedAt.toISOString(),
  };
}

export async function listMyAttempts(userId: string, courseId: string): Promise<QuizAttemptSummary[]> {
  const attempts = await QuizAttemptModel.find({ user: userId, course: courseId })
    .sort({ submittedAt: -1 })
    .limit(50)
    .lean();
  return attempts.map((attempt) => ({
    id: String(attempt._id),
    scorePercent: attempt.scorePercent,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt.toISOString(),
  }));
}
