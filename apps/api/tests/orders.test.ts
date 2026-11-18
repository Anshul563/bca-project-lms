import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { setupTestDatabase, teardownTestDatabase } from "./helpers/database.js";
import { CourseModel } from "../src/modules/courses/course.model.js";
import { UserModel } from "../src/modules/users/user.model.js";

let app: ReturnType<typeof createApp>;
let instructorToken: string;
let studentToken: string;
let otherStudentToken: string;
let paidCourseId: string;
let freeCourseId: string;
let orderId: string;

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

async function createPublishedCourse(price: number, title: string): Promise<string> {
  const created = await request(app)
    .post("/api/v1/courses")
    .set("Authorization", `Bearer ${instructorToken}`)
    .send({
      title,
      description: "A description that is comfortably longer than thirty characters for validation.",
    });
  const courseId = created.body.data.id as string;
  await CourseModel.updateOne(
    { _id: courseId },
    { $set: { status: "published", publishedAt: new Date(), price } },
  );
  return courseId;
}

beforeAll(async () => {
  instructorToken = await registerAndLogin("Pay Instructor", "pay-instructor@test.local");
  studentToken = await registerAndLogin("Pay Student", "pay-student@test.local");
  otherStudentToken = await registerAndLogin("Other Student", "pay-other@test.local");

  await UserModel.updateOne({ email: "pay-instructor@test.local" }, { $set: { role: "instructor" } });

  paidCourseId = await createPublishedCourse(49.99, "Premium Paid Course");
  freeCourseId = await createPublishedCourse(0, "Free Companion Course");
});

describe("paid enrollment gate", () => {
  it("refuses direct enrollment in a paid course", async () => {
    const res = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: paidCourseId });
    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/paid course/i);
  });

  it("still enrolls in free courses directly", async () => {
    const res = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: freeCourseId });
    expect(res.status).toBe(201);
  });

  it("rejects orders for free courses", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: freeCourseId });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/free/i);
  });
});

describe("orders and mock checkout", () => {
  it("creates a pending order priced from the course", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: paidCourseId });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      amount: 49.99,
      currency: "USD",
      status: "pending",
      provider: "mock",
    });
    expect(res.body.data.course.title).toBe("Premium Paid Course");
    orderId = res.body.data.id;
  });

  it("reuses the existing pending order instead of stacking duplicates", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: paidCourseId });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(orderId);

    const mine = await request(app).get("/api/v1/orders/my").set("Authorization", `Bearer ${studentToken}`);
    expect(mine.body.data.filter((o: { status: string }) => o.status === "pending")).toHaveLength(1);
  });

  it("does not let another user pay someone else's order", async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .set("Authorization", `Bearer ${otherStudentToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it("confirms payment and enrolls the learner", async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("paid");
    expect(res.body.data.paidAt).toBeDefined();

    const enrollments = await request(app)
      .get("/api/v1/enrollments/my")
      .set("Authorization", `Bearer ${studentToken}`);
    const enrollment = enrollments.body.data.find((entry: { course: { id: string } | null }) => entry.course?.id === paidCourseId);
    expect(enrollment).toBeDefined();
    expect(enrollment.status).toBe("active");
  });

  it("is idempotent — paying twice neither double-enrolls nor double-counts", async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/pay`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("paid");

    const detail = await request(app).get(`/api/v1/courses/${res.body.data.course.slug}`);
    expect(detail.body.data.enrollmentCount).toBe(1);
  });

  it("refuses new orders once enrolled", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ courseId: paidCourseId });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already enrolled/i);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/orders/my");
    expect(res.status).toBe(401);
  });
});
