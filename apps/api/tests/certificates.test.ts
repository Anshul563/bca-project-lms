import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { setupTestDatabase, teardownTestDatabase } from "./helpers/database.js";
import { CourseModel } from "../src/modules/courses/course.model.js";
import { UserModel } from "../src/modules/users/user.model.js";

let app: ReturnType<typeof createApp>;
let instructorToken: string;
let studentToken: string;
let idleStudentToken: string;
let simpleCourseId: string;
let simpleLessonId: string;
let quizCourseId: string;
let quizLessonId: string;
let simpleSerial: string;

// Shared state (certificates accumulate); teardown drops the DB.
beforeAll(async () => {
  await setupTestDatabase();
  app = createApp();
});

afterAll(teardownTestDatabase);

async function registerAndLogin(name: string, email: string): Promise<string> {
  const res = await request(app).post("/api/v1/auth/register").send({ name, email, password: "Sup3rSecret" });
  expect(res.status).toBe(201);
  return res.body.data.accessToken as string;
}

/** Creates a published 1-lesson course owned by the instructor and enrolls the student. */
async function createPublishedCourse(
  title: string,
  token: string,
): Promise<{ courseId: string; lessonId: string }> {
  const created = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({
      title,
      description: "Course description long enough to pass the thirty character validation requirement easily.",
    });
  const courseId = created.body.data.id as string;

  const section = await request(app)
    .post(`/api/v1/courses/id/${courseId}/sections`)
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({ title: "Section 1" });
  const lesson = await request(app)
    .post(`/api/v1/courses/id/${courseId}/sections/${section.body.data.id}/lessons`)
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({ title: "Only lesson", type: "article", content: "Read me.", durationMinutes: 3 });

  await CourseModel.updateOne({ _id: courseId }, { $set: { status: "published", publishedAt: new Date() } });

  const enroll = await request(app)
    .post("/api/v1/enrollments")
    .set("Authorization", `Bearer ${token}`)
    .send({ courseId });
  expect(enroll.status).toBe(201);

  return { courseId, lessonId: lesson.body.data.id as string };
}

async function completeLesson(token: string, courseId: string, lessonId: string): Promise<void> {
  const res = await request(app)
    .post(`/api/v1/progress/courses/${courseId}/lessons/${lessonId}/complete`)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
}

async function myCertificates(token: string) {
  const res = await request(app).get("/api/v1/certificates/my").set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.data as { serial: string; course: { id: string; title: string }; quizScorePercent?: number; lessonsCompleted: number; totalLessons: number }[];
}

beforeAll(async () => {
  instructorToken = await registerAndLogin("Cert Instructor", "cert-instructor@test.local");
  studentToken = await registerAndLogin("Cert Student", "cert-student@test.local");
  idleStudentToken = await registerAndLogin("Idle Student", "cert-idle@test.local");

  await UserModel.updateOne({ email: "cert-instructor@test.local" }, { $set: { role: "instructor" } });

  ({ courseId: simpleCourseId, lessonId: simpleLessonId } = await createPublishedCourse("Certified Basics", studentToken));
  ({ courseId: quizCourseId, lessonId: quizLessonId } = await createPublishedCourse("Certified With Quiz", studentToken));
});

describe("certificate issuance (course without a quiz)", () => {
  it("issues no certificate before completion", async () => {
    const certificates = await myCertificates(studentToken);
    expect(certificates).toHaveLength(0);
  });

  it("issues a certificate automatically at 100% lesson completion", async () => {
    await completeLesson(studentToken, simpleCourseId, simpleLessonId);

    const certificates = await myCertificates(studentToken);
    const certificate = certificates.find((entry) => entry.course.id === simpleCourseId);
    expect(certificate).toBeDefined();
    expect(certificate!.serial).toMatch(/^LMS-\d{4}-[0-9A-F]{8}$/);
    expect(certificate!.lessonsCompleted).toBe(1);
    expect(certificate!.totalLessons).toBe(1);
    expect(certificate!.quizScorePercent).toBeUndefined();
    expect(certificate!.course.title).toBe("Certified Basics");
    simpleSerial = certificate!.serial;
  });

  it("is idempotent — replays and further visits never duplicate", async () => {
    await completeLesson(studentToken, simpleCourseId, simpleLessonId);
    const certificates = await myCertificates(studentToken);
    expect(certificates.filter((entry) => entry.course.id === simpleCourseId)).toHaveLength(1);
  });

  it("verifies publicly by serial (case-insensitive)", async () => {
    const res = await request(app).get(`/api/v1/certificates/${simpleSerial.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ serial: simpleSerial, learner: { name: "Cert Student" } });
    expect(res.body.data.course.instructorName).toBe("Cert Instructor");
  });

  it("404s for unknown serials and requires auth for the personal list", async () => {
    const missing = await request(app).get("/api/v1/certificates/LMS-2026-DEADBEEF");
    expect(missing.status).toBe(404);

    const anonymous = await request(app).get("/api/v1/certificates/my");
    expect(anonymous.status).toBe(401);
  });

  it("does not issue certificates to learners who never completed a course", async () => {
    const certificates = await myCertificates(idleStudentToken);
    expect(certificates).toHaveLength(0);
  });
});

describe("certificate issuance (course with a quiz)", () => {
  let questionId: string;
  let optionIds: string[];

  it("withholds the certificate when lessons are done but the quiz is pending", async () => {
    const quiz = await request(app)
      .post(`/api/v1/courses/id/${quizCourseId}/quizzes`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Final check",
        passScore: 70,
        questions: [
          {
            text: "Pick the correct one",
            type: "single_choice",
            points: 1,
            correctOptionIndexes: [1],
            options: [{ text: "Wrong" }, { text: "Right" }],
          },
        ],
      });
    expect(quiz.status).toBe(200);

    const view = await request(app)
      .get(`/api/v1/courses/id/${quizCourseId}/quiz`)
      .set("Authorization", `Bearer ${studentToken}`);
    questionId = view.body.data.questions[0].id;
    optionIds = view.body.data.questions[0].options.map((option: { id: string }) => option.id);

    await completeLesson(studentToken, quizCourseId, quizLessonId);

    const certificates = await myCertificates(studentToken);
    expect(certificates.some((entry) => entry.course.id === quizCourseId)).toBe(false);
  });

  it("still withholds after a failing attempt", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/id/${quizCourseId}/quiz/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: [{ questionId, selectedOptionIds: [optionIds[0]] }] });
    expect(res.status).toBe(201);
    expect(res.body.data.passed).toBe(false);

    const certificates = await myCertificates(studentToken);
    expect(certificates.some((entry) => entry.course.id === quizCourseId)).toBe(false);
  });

  it("issues the certificate once the quiz is passed, recording the score", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/id/${quizCourseId}/quiz/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: [{ questionId, selectedOptionIds: [optionIds[1]] }] });
    expect(res.status).toBe(201);
    expect(res.body.data.passed).toBe(true);

    const certificates = await myCertificates(studentToken);
    const certificate = certificates.find((entry) => entry.course.id === quizCourseId);
    expect(certificate).toBeDefined();
    expect(certificate!.quizScorePercent).toBe(100);
  });

  it("lists all certificates newest-first", async () => {
    const certificates = await myCertificates(studentToken);
    expect(certificates).toHaveLength(2);
    expect(certificates[0]!.course.id).toBe(quizCourseId);
  });
});
