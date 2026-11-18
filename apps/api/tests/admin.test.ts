import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { setupTestDatabase, teardownTestDatabase } from "./helpers/database.js";
import { UserModel } from "../src/modules/users/user.model.js";

let app: ReturnType<typeof createApp>;
let adminToken: string;
let secondAdminToken: string;
let studentToken: string;
let applicantToken: string;
let applicantId: string;
let secondApplicantToken: string;
let instructorToken: string;

// Shared state across tests (applications/courses are reviewed in order);
// teardown drops the DB. fileParallelism is off, so the DB is ours alone.
beforeAll(async () => {
  await setupTestDatabase();
  app = createApp();
});

afterAll(teardownTestDatabase);

async function registerAndLogin(name: string, email: string): Promise<{ token: string; id: string }> {
  const res = await request(app).post("/api/v1/auth/register").send({ name, email, password: "Sup3rSecret" });
  expect(res.status).toBe(201);
  return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string };
}

beforeAll(async () => {
  const admin = await registerAndLogin("Admin One", "admin1@test.local");
  const admin2 = await registerAndLogin("Admin Two", "admin2@test.local");
  const student = await registerAndLogin("Plain Student", "plain@test.local");
  const applicant = await registerAndLogin("Applicant One", "applicant1@test.local");
  const applicant2 = await registerAndLogin("Applicant Two", "applicant2@test.local");
  const instructor = await registerAndLogin("Existing Instructor", "existing-instructor@test.local");
  adminToken = admin.token;
  secondAdminToken = admin2.token;
  studentToken = student.token;
  applicantToken = applicant.token;
  applicantId = applicant.id;
  secondApplicantToken = applicant2.token;
  instructorToken = instructor.token;

  await UserModel.updateMany(
    { email: { $in: ["admin1@test.local", "admin2@test.local"] } },
    { $set: { role: "admin" } },
  );
  await UserModel.updateOne(
    { email: "existing-instructor@test.local" },
    { $set: { role: "instructor" } },
  );
});

describe("admin access control", () => {
  it("rejects anonymous and non-admin callers", async () => {
    const anonymous = await request(app).get("/api/v1/admin/users");
    expect(anonymous.status).toBe(401);

    for (const token of [studentToken, instructorToken]) {
      const res = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  });
});

describe("instructor applications", () => {
  it("lets a student apply, then exposes it in the admin queue", async () => {
    const apply = await request(app)
      .post("/api/v1/auth/apply-instructor")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ bio: "I have ten years of experience building web applications and teaching.", website: "https://example.com" });
    expect(apply.status).toBe(201);

    const list = await request(app)
      .get("/api/v1/admin/instructor-applications?status=pending")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    const application = list.body.data.find(
      (entry: { user: { id: string } }) => entry.user.id === applicantId,
    );
    expect(application).toBeDefined();
    expect(application.user.email).toBe("applicant1@test.local");
  });

  it("approves an application and promotes the user to instructor", async () => {
    const list = await request(app)
      .get("/api/v1/admin/instructor-applications?status=pending")
      .set("Authorization", `Bearer ${adminToken}`);
    const application = list.body.data.find((entry: { user: { id: string } }) => entry.user.id === applicantId);

    const approve = await request(app)
      .patch(`/api/v1/admin/instructor-applications/${application.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approve" });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("approved");

    const me = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${applicantToken}`);
    expect(me.body.data.role).toBe("instructor");
  });

  it("refuses to review an application twice", async () => {
    const list = await request(app)
      .get("/api/v1/admin/instructor-applications?status=approved")
      .set("Authorization", `Bearer ${adminToken}`);
    const application = list.body.data.find((entry: { user: { id: string } }) => entry.user.id === applicantId);

    const again = await request(app)
      .patch(`/api/v1/admin/instructor-applications/${application.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "reject", reason: "Changing my mind" });
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already/i);
  });

  it("requires a reason to reject and records it", async () => {
    await request(app)
      .post("/api/v1/auth/apply-instructor")
      .set("Authorization", `Bearer ${secondApplicantToken}`)
      .send({ bio: "A second applicant with a perfectly long enough biography for validation." });

    const pending = await request(app)
      .get("/api/v1/admin/instructor-applications?status=pending")
      .set("Authorization", `Bearer ${adminToken}`);
    const application = pending.body.data[0];

    const noReason = await request(app)
      .patch(`/api/v1/admin/instructor-applications/${application.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "reject" });
    expect(noReason.status).toBe(422);

    const reject = await request(app)
      .patch(`/api/v1/admin/instructor-applications/${application.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "reject", reason: "Please add verifiable teaching experience." });
    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe("rejected");
    expect(reject.body.data.reviewNote).toMatch(/verifiable/);

    const me = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${secondApplicantToken}`);
    expect(me.body.data.role).toBe("student");
  });
});

describe("user management", () => {
  it("lists and searches users", async () => {
    const res = await request(app)
      .get("/api/v1/admin/users?search=plain&role=student")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].email).toBe("plain@test.local");
  });

  it("suspends a user, blocking their session, then reactivates them", async () => {
    const me = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${studentToken}`);
    const userId = me.body.data.id as string;

    const suspend = await request(app)
      .patch(`/api/v1/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "suspended" });
    expect(suspend.status).toBe(200);
    expect(suspend.body.data.status).toBe("suspended");

    const blocked = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${studentToken}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/suspended/i);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "plain@test.local", password: "Sup3rSecret" });
    expect(login.status).toBe(403);

    const reactivate = await request(app)
      .patch(`/api/v1/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "active" });
    expect(reactivate.status).toBe(200);
  });

  it("changes roles", async () => {
    const me = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${studentToken}`);
    const res = await request(app)
      .patch(`/api/v1/admin/users/${me.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "instructor" });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("instructor");

    // Restore for later tests.
    await UserModel.updateOne({ _id: me.body.data.id }, { $set: { role: "student" } });
  });

  it("prevents admins from modifying themselves", async () => {
    const me = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${secondAdminToken}`);
    const res = await request(app)
      .patch(`/api/v1/admin/users/${me.body.data.id}`)
      .set("Authorization", `Bearer ${secondAdminToken}`)
      .send({ status: "suspended" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/your own/i);
  });

  it("validates update payloads", async () => {
    const me = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${studentToken}`);
    const res = await request(app)
      .patch(`/api/v1/admin/users/${me.body.data.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(422);
  });
});

describe("course moderation", () => {
  let courseId: string;
  let courseSlug: string;

  beforeAll(async () => {
    const created = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Awaiting Review Course",
        description: "A complete description long enough to satisfy the thirty character validation requirement.",
      });
    courseId = created.body.data.id as string;
    courseSlug = created.body.data.slug as string;

    const section = await request(app)
      .post(`/api/v1/courses/id/${courseId}/sections`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Getting started" });
    await request(app)
      .post(`/api/v1/courses/id/${courseId}/sections/${section.body.data.id}/lessons`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ title: "Intro lesson", type: "article", content: "Hello." });

    const submit = await request(app)
      .post(`/api/v1/courses/id/${courseId}/submit-for-review`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(submit.status).toBe(200);
    expect(submit.body.data.status).toBe("pending_review");
  });

  it("lists courses awaiting review", async () => {
    const res = await request(app)
      .get("/api/v1/admin/courses?status=pending_review")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const course = res.body.data.find((entry: { id: string }) => entry.id === courseId);
    expect(course).toBeDefined();
    expect(course.instructor.name).toBe("Existing Instructor");
  });

  it("rejects with a required note and shows it to the instructor", async () => {
    const noNote = await request(app)
      .patch(`/api/v1/admin/courses/${courseId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "reject" });
    expect(noNote.status).toBe(422);

    const reject = await request(app)
      .patch(`/api/v1/admin/courses/${courseId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "reject", note: "Please add at least five lessons and a quiz." });
    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe("draft");

    const mine = await request(app)
      .get(`/api/v1/courses/id/${courseId}`)
      .set("Authorization", `Bearer ${instructorToken}`);
    expect(mine.body.data.reviewNote).toMatch(/five lessons/);

    const publicView = await request(app).get(`/api/v1/courses/${courseSlug}`);
    expect(publicView.status).toBe(404);
  });

  it("publishes on approval and clears prior feedback", async () => {
    await request(app)
      .post(`/api/v1/courses/id/${courseId}/submit-for-review`)
      .set("Authorization", `Bearer ${instructorToken}`);

    const approve = await request(app)
      .patch(`/api/v1/admin/courses/${courseId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approve" });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("published");
    expect(approve.body.data.publishedAt).toBeDefined();
    expect(approve.body.data.reviewNote).toBeUndefined();

    const publicView = await request(app).get(`/api/v1/courses/${courseSlug}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.data.status).toBe("published");
  });

  it("refuses to moderate courses that aren't pending review", async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/courses/${courseId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "reject", note: "Not waiting for review" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/awaiting review/i);
  });

  it("keeps drafts invisible until approved", async () => {
    const draft = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Still A Draft",
        description: "Another description that is definitely long enough to pass validation checks.",
      });
    expect(draft.status).toBe(201);

    const list = await request(app).get("/api/v1/courses?limit=50");
    const found = list.body.data.find((entry: { id: string }) => entry.id === draft.body.data.id);
    expect(found).toBeUndefined();
  });
});
