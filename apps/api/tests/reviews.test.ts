import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { setupTestDatabase, teardownTestDatabase } from "./helpers/database.js";
import { CourseModel } from "../src/modules/courses/course.model.js";
import { UserModel } from "../src/modules/users/user.model.js";

let app: ReturnType<typeof createApp>;
let instructorToken: string;
let studentToken: string;
let secondStudentToken: string;
let outsiderToken: string;
let courseId: string;
let courseSlug: string;

// Shared state across tests — teardown drops the database at the end.
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

beforeAll(async () => {
  instructorToken = await registerAndLogin("Reviews Instructor", "reviews-instructor@test.local");
  studentToken = await registerAndLogin("Review Student", "reviews-student@test.local");
  secondStudentToken = await registerAndLogin("Second Student", "reviews-student2@test.local");
  outsiderToken = await registerAndLogin("Review Outsider", "reviews-outsider@test.local");

  await UserModel.updateOne({ email: "reviews-instructor@test.local" }, { $set: { role: "instructor" } });

  const created = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({
      title: "Reviewed Course",
      description: "A course description long enough to pass the thirty character validation requirement easily.",
    });
  courseId = created.body.data.id as string;
  courseSlug = created.body.data.slug as string;
  await CourseModel.updateOne({ _id: courseId }, { $set: { status: "published", publishedAt: new Date() } });

  for (const token of [studentToken, secondStudentToken]) {
    const enroll = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId });
    expect(enroll.status).toBe(201);
  }
});

describe("review authoring", () => {
  it("blocks non-enrolled users from reviewing", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/id/${courseId}/reviews/my`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ rating: 5, comment: "I was never enrolled" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/enroll/i);
  });

  it("validates rating bounds", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/id/${courseId}/reviews/my`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ rating: 6 });
    expect(res.status).toBe(422);
  });

  it("creates the learner's review and updates course rating", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/id/${courseId}/reviews/my`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ rating: 5, comment: "Excellent course, learned a lot." });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ rating: 5, isMine: true });
    expect(res.body.data.user.name).toBe("Review Student");

    const detail = await request(app).get(`/api/v1/courses/${courseSlug}`);
    expect(detail.body.data.ratingAverage).toBe(5);
    expect(detail.body.data.ratingCount).toBe(1);
  });

  it("edits in place (one review per learner) and clears a removed comment", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/id/${courseId}/reviews/my`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ rating: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(3);
    expect(res.body.data.comment).toBeUndefined();

    const detail = await request(app).get(`/api/v1/courses/${courseSlug}`);
    expect(detail.body.data.ratingCount).toBe(1);
    expect(detail.body.data.ratingAverage).toBe(3);
  });

  it("averages ratings across learners", async () => {
    const res = await request(app)
      .put(`/api/v1/courses/id/${courseId}/reviews/my`)
      .set("Authorization", `Bearer ${secondStudentToken}`)
      .send({ rating: 4, comment: "Solid content." });
    expect(res.status).toBe(200);

    const detail = await request(app).get(`/api/v1/courses/${courseSlug}`);
    expect(detail.body.data.ratingCount).toBe(2);
    expect(detail.body.data.ratingAverage).toBe(3.5);
  });
});

describe("review listing", () => {
  it("returns the public list newest-first with learner names", async () => {
    const res = await request(app).get(`/api/v1/courses/${courseSlug}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].user.name).toBe("Second Student");
    expect(res.body.data[0].isMine).toBeUndefined();
    expect(res.body.meta.total).toBe(2);
  });

  it("exposes the caller's own review", async () => {
    const res = await request(app)
      .get(`/api/v1/courses/id/${courseId}/reviews/my`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ rating: 3, isMine: true });
  });

  it("requires authentication for the personal review endpoint", async () => {
    const res = await request(app).get(`/api/v1/courses/id/${courseId}/reviews/my`);
    expect(res.status).toBe(401);
  });

  it("404s for unknown courses", async () => {
    const res = await request(app).get("/api/v1/courses/does-not-exist/reviews");
    expect(res.status).toBe(404);
  });
});

describe("review removal", () => {
  it("deletes a review and recalculates the course rating", async () => {
    const res = await request(app)
      .delete(`/api/v1/courses/id/${courseId}/reviews/my`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);

    const mine = await request(app)
      .get(`/api/v1/courses/id/${courseId}/reviews/my`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(mine.body.data).toBeNull();

    const detail = await request(app).get(`/api/v1/courses/${courseSlug}`);
    expect(detail.body.data.ratingCount).toBe(1);
    expect(detail.body.data.ratingAverage).toBe(4);
  });

  it("404s when there is no review to delete", async () => {
    const res = await request(app)
      .delete(`/api/v1/courses/id/${courseId}/reviews/my`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(404);
  });
});
