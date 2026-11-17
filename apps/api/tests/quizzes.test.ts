import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { setupTestDatabase, teardownTestDatabase } from "./helpers/database.js";
import { CourseModel } from "../src/modules/courses/course.model.js";
import { UserModel } from "../src/modules/users/user.model.js";

let app: ReturnType<typeof createApp>;
let instructorToken: string;
let studentToken: string;
let outsiderToken: string;
let courseId: string;

// Shared state across tests (quiz exists once per course; attempts
// accumulate), so there is no per-test wipe; teardown drops the DB.
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

interface SeedOptions {
  courseId: string;
  questionIds: string[];
  optionIds: string[][];
  passScore: number;
}

let seed: SeedOptions;

beforeAll(async () => {
  instructorToken = await registerAndLogin("Quiz Instructor", "quiz-instructor@test.local");
  studentToken = await registerAndLogin("Quiz Student", "quiz-student@test.local");
  outsiderToken = await registerAndLogin("Quiz Outsider", "quiz-outsider@test.local");

  await UserModel.updateOne({ email: "quiz-instructor@test.local" }, { $set: { role: "instructor" } });

  const created = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({
      title: "Quiz Demo Course",
      description: "A long enough description to clear the thirty character validation bar with room to spare.",
    });
  courseId = created.body.data.id as string;
  await CourseModel.updateOne({ _id: courseId }, { $set: { status: "published", publishedAt: new Date() } });

  // Instructor publishes a quiz: 1 single-choice + 1 multiple-choice.
  const quiz = await request(app)
    .post(`/api/v1/courses/id/${courseId}/quizzes`)
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({
      title: "Final knowledge check",
      passScore: 70,
      questions: [
        {
          text: "What does HTTP stand for?",
          type: "single_choice",
          points: 1,
          correctOptionIndexes: [1],
          options: [{ text: "HyperText Transfer Protocol" }, { text: "HyperTransfer Text Protocol" }, { text: "High Transfer Text Protocol" }],
        },
        {
          text: "Which are HTTP methods?",
          type: "multiple_choice",
          points: 2,
          correctOptionIndexes: [0, 2],
          options: [{ text: "GET" }, { text: "SEND" }, { text: "POST" }, { text: "RECEIVE" }],
        },
      ],
    });
  // Upsert endpoint: 200 for both create and replace (documented in docs/API.md).
  expect(quiz.status).toBe(200);

  const instructorQuiz = await request(app)
    .get(`/api/v1/courses/id/${courseId}/quizzes`)
    .set("Authorization", `Bearer ${instructorToken}`);
  const questions = instructorQuiz.body.data.questions as {
    id: string;
    correctOptionIds: string[];
    options: { id: string }[];
  }[];
  seed = {
    courseId,
    questionIds: questions.map((q) => q.id),
    optionIds: questions.map((q) => q.options.map((o) => o.id)),
    passScore: 70,
  };

  const enroll = await request(app)
    .post("/api/v1/enrollments")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({ courseId });
  expect(enroll.status).toBe(201);
});

/** Answer selection helpers over the seeded quiz. */
function correctForQuestion(index: number): string[] {
  // Map authoring indexes to persisted option ids via the instructor view.
  // Seeded: q0 correct idx 1, q1 correct idx [0, 2].
  const authIndexes: number[][] = [[1], [0, 2]];
  return authIndexes[index]!.map((i) => seed.optionIds[index]![i]!);
}

describe("instructor quiz authoring", () => {
  it("blocks students from authoring quizzes (RBAC)", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/id/${courseId}/quizzes`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "Sneaky quiz", questions: [] });
    expect(res.status).toBe(403);
  });

  it("rejects correct answers referencing nonexistent options", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/id/${courseId}/quizzes`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Broken quiz",
        questions: [
          {
            text: "Bad question?",
            correctOptionIndexes: [5],
            options: [{ text: "A" }, { text: "B" }],
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.code ?? res.body.message).toMatch(/option/i);
  });

  it("keeps grading data out of the student view", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/id/${courseId}/quiz`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body.data);
    expect(body).not.toContain("correctOption");
    expect(body).not.toContain("correct");
    // But questions and options are visible.
    expect(res.body.data.questions).toHaveLength(2);
    expect(res.body.data.questions[0].options.length).toBeGreaterThan(1);
  });
});

describe("quiz attempts", () => {
  it("grades a perfect attempt as passed with 100%", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/id/${courseId}/quiz/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: seed.questionIds[0], selectedOptionIds: correctForQuestion(0) },
          { questionId: seed.questionIds[1], selectedOptionIds: correctForQuestion(1) },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      scorePercent: 100,
      passed: true,
      passScore: 70,
      totalPoints: 3,
      earnedPoints: 3,
    });
    expect(res.body.data.perQuestion.every((q: { correct: boolean }) => q.correct)).toBe(true);
  });

  it("grades a partially wrong attempt and requires the pass score", async () => {
    // Wrong on the 2-point question → 1/3 = 33% → fail.
    const res = await request(app)
      .post(`/api/v1/courses/id/${courseId}/quiz/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: seed.questionIds[0], selectedOptionIds: correctForQuestion(0) },
          { questionId: seed.questionIds[1], selectedOptionIds: [seed.optionIds[1]![0]!] }, // incomplete selection
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.scorePercent).toBe(33);
    expect(res.body.data.passed).toBe(false);
  });

  it("allows retakes after a failed attempt", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/id/${courseId}/quiz/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: seed.questionIds[0], selectedOptionIds: correctForQuestion(0) },
          { questionId: seed.questionIds[1], selectedOptionIds: correctForQuestion(1) },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.passed).toBe(true);

    const mine = await request(app)
      .get(`/api/v1/courses/id/${courseId}/quiz/attempts/my`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(3);
    // Newest first; the failed attempt is the middle one.
    expect(mine.body.data[0].passed).toBe(true);
    expect(mine.body.data[1].passed).toBe(false);
  });

  it("never leaks correct answers in the student quiz payload", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/id/${courseId}/quiz`)
      .set("Authorization", `Bearer ${studentToken}`);
    for (const question of res.body.data.questions as Record<string, unknown>[]) {
      expect(question).not.toHaveProperty("correctOptionIds");
      expect(question).not.toHaveProperty("correctOptionIndexes");
    }
  });

  it("rejects attempts that skip every question", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/id/${courseId}/quiz/attempts`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ answers: [{ questionId: "000000000000000000000000", selectedOptionIds: [] }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one question/i);
  });

  it("blocks non-enrolled students from taking the quiz", async () => {
    const res = await request(app)
      .post(`/api/v1/courses/id/${courseId}/quiz/attempts`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({
        answers: [{ questionId: seed.questionIds[0], selectedOptionIds: correctForQuestion(0) }],
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/enroll/i);
  });

  it("hides quizzes from non-enrolled students too", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/id/${courseId}/quiz`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it("lets instructors see all attempts on their course", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/id/${courseId}/quizzes/attempts`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it("requires authentication for all quiz endpoints", async () => {
    const quizRes = await request(app).get(`/api/v1/courses/id/${courseId}/quiz`);
    expect(quizRes.status).toBe(401);
    const attemptRes = await request(app).post(`/api/v1/courses/id/${courseId}/quiz/attempts`).send({ answers: [] });
    expect(attemptRes.status).toBe(401);
  });
});
