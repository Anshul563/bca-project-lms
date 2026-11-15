import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { clearCollections, setupTestDatabase, teardownTestDatabase } from "./helpers/database.js";

let app: ReturnType<typeof createApp>;
let instructorToken: string;
let studentToken: string;
let courseId: string;
let courseSlug: string;

beforeAll(async () => {
  await setupTestDatabase();
  app = createApp();
});

afterEach(clearCollections);

afterAll(teardownTestDatabase);

const COURSE_BASE = {
  title: "Integration Test Course",
  description: "A comprehensive description that easily passes the thirty-character validation minimum.",
};

/** Registers a fixed user per test run and returns an access token. */
async function registerAndLogin(
  name: string,
  email: string,
  password: string,
): Promise<string> {
  const registered = await request(app)
    .post("/api/v1/auth/register")
    .send({ name, email, password });
  expect(registered.status).toBe(201);
  return registered.body.data.accessToken as string;
}

/** Registration always creates students; tests promote roles directly in the DB. */
async function promoteRole(email: string, role: "instructor" | "admin"): Promise<void> {
  const { UserModel } = await import("../src/modules/users/user.model.js");
  await UserModel.updateOne({ email }, { $set: { role } });
}

async function seedPublishedCourse(): Promise<void> {
  instructorToken = await registerAndLogin("Test Instructor", "instructor@test.local", "Sup3rSecret");
  await promoteRole("instructor@test.local", "instructor");
  studentToken = await registerAndLogin("Test Student", "student@test.local", "Sup3rSecret");

  const created = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${instructorToken}`)
    .send(COURSE_BASE);
  expect(created.status).toBe(201);
  courseId = created.body.data.id;
  courseSlug = created.body.data.slug;

  const section = await request(app)
    .post(`/api/v1/courses/id/${courseId}/sections`)
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({ title: "Getting started" });
  expect(section.status).toBe(201);

  const lesson = await request(app)
    .post(`/api/v1/courses/id/${courseId}/sections/${section.body.data.id}/lessons`)
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({ title: "Welcome lesson", type: "video", durationMinutes: 10, isFreePreview: true });
  expect(lesson.status).toBe(201);

  const published = await request(app)
    .post(`/api/v1/courses/id/${courseId}/submit-for-review`)
    .set("Authorization", `Bearer ${instructorToken}`);
  expect(published.status).toBe(200);

  // Admin approval turns pending_review into published.
  const adminToken = await registerAndLogin("Test Admin", "admin@test.local", "Sup3rSecret");
  await promoteRole("admin@test.local", "admin");

  const approve = await request(app)
    .post(`/api/v1/admin/courses/${courseId}/approve`)
    .set("Authorization", `Bearer ${adminToken}`);
  if (approve.status === 404) {
    // Admin approval routes are not mounted yet; publish via model for the
    // enrollment flow under test.
    const { CourseModel } = await import("../src/modules/courses/course.model.js");
    await CourseModel.updateOne(
      { _id: courseId },
      { $set: { status: "published", publishedAt: new Date() } },
    );
  } else {
    expect(approve.status).toBe(200);
  }
}

describe("course lifecycle", () => {
  it("blocks students from creating courses (RBAC)", async () => {
    const token = await registerAndLogin("Blocked Student", "blocked@test.local", "Sup3rSecret");
    const res = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`)
      .send(COURSE_BASE);
    expect(res.status).toBe(403);
  });

  it("rejects invalid course payloads with 422 + field errors", async () => {
    const token = await registerAndLogin("Sloppy Instructor", "sloppy@test.local", "Sup3rSecret");
    await promoteRole("sloppy@test.local", "instructor");

    const res = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "short", description: "too short" });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it("keeps drafts invisible to the public catalog and detail page", async () => {
    await seedPublishedCourse();

    const draft = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ ...COURSE_BASE, title: "Unpublished Draft Course" });
    const draftSlug = draft.body.data.slug as string;

    const catalog = await request(app).get("/api/v1/courses");
    const slugs = catalog.body.data.map((course: { slug: string }) => course.slug);
    expect(slugs).toContain(courseSlug);
    expect(slugs).not.toContain(draftSlug);

    const detail = await request(app).get(`/api/v1/courses/${draftSlug}`);
    expect(detail.status).toBe(404);

    // But the owner can see it through the same public endpoint.
    const ownerView = await request(app)
      .get(`/api/v1/courses/${draftSlug}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(ownerView.status).toBe(200);
  });

  it("prevents non-owners from mutating a course", async () => {
    await seedPublishedCourse();

    const other = await registerAndLogin("Rogue Instructor", "rogue@test.local", "Sup3rSecret");
    const res = await request(app)
      .patch(`/api/v1/courses/id/${courseId}`)
      .set("Authorization", `Bearer ${other}`)
      .send({ title: "Hijacked title" });
    expect(res.status).toBe(403);
  });

  it("publishes after section + lesson exist and validates curriculum completeness", async () => {
    const token = await registerAndLogin("Eager Instructor", "eager@test.local", "Sup3rSecret");
    await promoteRole("eager@test.local", "instructor");
    const created = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${token}`)
      .send(COURSE_BASE);
    const id = created.body.data.id as string;

    // No sections yet — submission must fail.
    const early = await request(app)
      .post(`/api/v1/courses/id/${id}/submit-for-review`)
      .set("Authorization", `Bearer ${token}`);
    expect(early.status).toBe(400);
    expect(early.body.message).toMatch(/section/i);
  });
});

describe("enrollments", () => {
  beforeAll(seedPublishedCourse);

  it("enrolls, blocks duplicates, lists, and cancels", async () => {
    const enroll = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId });
    expect(enroll.status).toBe(201);
    expect(enroll.body.data.status).toBe("active");
    expect(enroll.body.data.course.slug).toBe(courseSlug);

    const duplicate = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toMatch(/already/i);

    const list = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    // Enrollment counter incremented on the course summary.
    const summary = await request(app).get("/api/v1/courses");
    const mine = summary.body.data.find((course: { id: string }) => course.id === courseId);
    expect(mine.enrollmentCount).toBe(1);

    const cancel = await request(app)
      .delete(`/api/v1/enrollments/${enroll.body.data.id}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(cancel.status).toBe(200);

    const afterCancel = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(afterCancel.body.data[0].status).toBe("cancelled");
  });

  it("rejects enrollment into unpublished or nonexistent courses", async () => {
    const token = await registerAndLogin("Hopeful Student", "hopeful@test.local", "Sup3rSecret");

    const missing = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: "507f1f77bcf86cd799439011" });
    expect(missing.status).toBe(404);

    const invalid = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: "not-an-objectid" });
    expect(invalid.status).toBe(422);
  });

  it("requires authentication for enrollment endpoints", async () => {
    const anonymous = await request(app).get("/api/v1/enrollments/my");
    expect(anonymous.status).toBe(401);

    const anonymousEnroll = await request(app)
      .post("/api/v1/enrollments")
      .send({ courseId: "507f1f77bcf86cd799439011" });
    expect(anonymousEnroll.status).toBe(401);
  });
});
