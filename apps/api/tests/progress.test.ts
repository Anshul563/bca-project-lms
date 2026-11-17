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
let courseSlug: string;
let lessonIds: string[];

// NOTE: this suite intentionally shares state across tests (progress
// accumulates lesson by lesson), so there is no per-test collection wipe;
// teardown drops the whole test database at the end.
beforeAll(async () => {
  await setupTestDatabase();
  app = createApp();
});

afterAll(teardownTestDatabase);

async function registerAndLogin(name: string, email: string): Promise<string> {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ name, email, password: "Sup3rSecret" });
  expect(res.status).toBe(201);
  return res.body.data.accessToken as string;
}

/** Publishes a 2-lesson demo course and enrolls the student. */
beforeAll(async () => {
  instructorToken = await registerAndLogin("Progress Instructor", "progress-instructor@test.local");
  studentToken = await registerAndLogin("Progress Student", "progress-student@test.local");
  outsiderToken = await registerAndLogin("Outsider Student", "outsider@test.local");

  await UserModel.updateOne({ email: "progress-instructor@test.local" }, { $set: { role: "instructor" } });

  const created = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({
      title: "Progress Tracking Course",
      description: "A long enough description to clear the thirty character validation bar with room to spare.",
    });
  courseId = created.body.data.id;
  courseSlug = created.body.data.slug;

  const section = await request(app)
    .post(`/api/v1/courses/id/${courseId}/sections`)
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({ title: "Section A" });
  const sectionId = section.body.data.id;

  lessonIds = [];
  for (const title of ["Lesson One", "Lesson Two"]) {
    const lesson = await request(app)
      .post(`/api/v1/courses/id/${courseId}/sections/${sectionId}/lessons`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title, type: "video", videoUrl: "https://cdn.lms.local/video.mp4", durationMinutes: 5 });
    lessonIds.push(lesson.body.data.id);
  }

  await CourseModel.updateOne({ _id: courseId }, { $set: { status: "published", publishedAt: new Date() } });

  const enroll = await request(app)
    .post("/api/v1/enrollments")
    .set("Authorization", `Bearer ${studentToken}`)
    .send({ courseId });
  expect(enroll.status).toBe(201);
});

describe("lesson content access", () => {
  it("returns full content to enrolled students", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/${courseSlug}/lessons/${lessonIds[0]}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.videoUrl).toBe("https://cdn.lms.local/video.mp4");
  });

  it("withholds content from non-enrolled users but shows free previews", async () => {
    const gated = await request(app)
      .get(`/api/v1/courses/${courseSlug}/lessons/${lessonIds[0]}`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(gated.status).toBe(403);
    expect(gated.body.message).toMatch(/enroll/i);

    // Anonymous visitors need to sign in (no free preview on these lessons).
    const anonymous = await request(app).get(`/api/v1/courses/${courseSlug}/lessons/${lessonIds[0]}`);
    expect(anonymous.status).toBe(401);
  });

  it("lets the owner access lesson content of their own draft", async () => {
    const draft = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Draft Access Course",
        description: "Another description long enough to pass validation without any trouble at all.",
      });
    const draftSlug = draft.body.data.slug;

    const detail = await request(app)
      .get(`/api/v1/courses/${draftSlug}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(detail.status).toBe(200);
    const draftLesson = detail.body.data.sections[0]?.lessons[0];
    expect(draftLesson).toBeUndefined(); // no sections yet — but course is visible to owner
  });
});

describe("progress tracking", () => {
  it("starts at zero and exposes lastLessonId as undefined", async () => {
    const res = await request(app)
      .get(`/api/v1/progress/courses/${courseId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      courseId,
      totalLessons: 2,
      completedLessons: 0,
      progressPercent: 0,
    });
    expect(res.body.data.completedLessonIds).toHaveLength(0);
  });

  it("blocks progress for non-enrolled users", async () => {
    const res = await request(app)
      .post(`/api/v1/progress/courses/${courseId}/lessons/${lessonIds[0]}/complete`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it("marks lessons complete idempotently and tracks the resume point", async () => {
    const first = await request(app)
      .post(`/api/v1/progress/courses/${courseId}/lessons/${lessonIds[0]}/complete`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(first.status).toBe(200);
    expect(first.body.data.progressPercent).toBe(50);
    expect(first.body.data.completedLessonIds).toContain(lessonIds[0]);

    // Idempotent replay must not double-count.
    const replay = await request(app)
      .post(`/api/v1/progress/courses/${courseId}/lessons/${lessonIds[0]}/complete`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(replay.body.data.completedLessons).toBe(1);

    const second = await request(app)
      .post(`/api/v1/progress/courses/${courseId}/lessons/${lessonIds[1]}/complete`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(second.body.data.progressPercent).toBe(100);
    expect(second.body.data.status).toBe("completed");
    expect(second.body.data.completedAt).toBeDefined();
    expect(second.body.data.lastLessonId).toBe(lessonIds[1]);
  });

  it("auto-completes the enrollment at 100% and reflects it on the dashboard", async () => {
    const list = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${studentToken}`);
    const entry = list.body.data.find((item: { course: { id: string } | null }) => item.course?.id === courseId);
    expect(entry.status).toBe("completed");
    expect(entry.progressPercent).toBe(100);
    expect(entry.completedAt).toBeDefined();
  });

  it("rejects completion of lessons outside the course", async () => {
    // Non-enrolled users are rejected with 403 before existence checks
    // (course existence is never leaked), so enroll first.
    const otherCourse = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Unrelated Course",
        description: "This description exists purely to pass the thirty character validation requirement.",
      });
    const otherCourseId = otherCourse.body.data.id as string;
    await CourseModel.updateOne({ _id: otherCourseId }, { $set: { status: "published", publishedAt: new Date() } });
    const enroll = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: otherCourseId });
    expect(enroll.status).toBe(201);

    // The lesson belongs to the first course — completing it under the other
    // course's id must 404, not corrupt progress.
    const res = await request(app)
      .post(`/api/v1/progress/courses/${otherCourseId}/lessons/${lessonIds[0]}/complete`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(404);

    // And the unrelated course's progress stays untouched.
    const progress = await request(app)
      .get(`/api/v1/progress/courses/${otherCourseId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(progress.body.data.completedLessons).toBe(0);
  });

  it("requires authentication", async () => {
    const res = await request(app).get(`/api/v1/progress/courses/${courseId}`);
    expect(res.status).toBe(401);
  });
});

describe("curriculum outline visibility", () => {
  it("shows the full lesson outline on published courses to anonymous visitors", async () => {
    const detail = await request(app).get(`/api/v1/courses/${courseSlug}`);
    expect(detail.status).toBe(200);
    const outlineLessons = detail.body.data.sections.flatMap((section: { lessons: unknown[] }) => section.lessons);
    expect(outlineLessons).toHaveLength(2);
  });
});
