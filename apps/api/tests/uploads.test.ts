import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { setupTestDatabase, teardownTestDatabase } from "./helpers/database.js";
import { UserModel } from "../src/modules/users/user.model.js";

let app: ReturnType<typeof createApp>;
let instructorToken: string;
let studentToken: string;

// 1x1 transparent PNG.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

beforeAll(async () => {
  await setupTestDatabase();
  app = createApp();

  const instructor = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "Upload Instructor", email: "upload-instructor@test.local", password: "Sup3rSecret" });
  instructorToken = instructor.body.data.accessToken as string;
  await UserModel.updateOne({ email: "upload-instructor@test.local" }, { $set: { role: "instructor" } });

  const student = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "Upload Student", email: "upload-student@test.local", password: "Sup3rSecret" });
  studentToken = student.body.data.accessToken as string;
});

afterAll(teardownTestDatabase);

describe("file uploads", () => {
  it("requires authentication and an instructor/admin role", async () => {
    const anonymous = await request(app).post("/api/v1/uploads");
    expect(anonymous.status).toBe(401);

    const student = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${studentToken}`)
      .attach("file", PNG_BYTES, { filename: "thumb.png", contentType: "image/png" });
    expect(student.status).toBe(403);
  });

  it("stores an image and serves it back over the public URL", async () => {
    const res = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${instructorToken}`)
      .attach("file", PNG_BYTES, { filename: "thumb.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body.data.mimeType).toBe("image/png");
    expect(res.body.data.size).toBe(PNG_BYTES.length);
    expect(res.body.data.url).toMatch(/^https?:\/\/.+\/uploads\/[0-9a-f-]+\.png$/);

    const path = new URL(res.body.data.url).pathname;
    const served = await request(app).get(path);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toContain("image/png");

    // The same URL can be attached to a course as its thumbnail.
    const created = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({
        title: "Course With Uploaded Thumbnail",
        description: "A course description long enough to satisfy the thirty character validation rule.",
      });
    const patched = await request(app)
      .patch(`/api/v1/courses/id/${created.body.data.id}`)
      .set("Authorization", `Bearer ${instructorToken}`)
      .send({ thumbnail: res.body.data.url });
    expect(patched.status).toBe(200);
  });

  it("rejects unsupported file types", async () => {
    const res = await request(app)
      .post("/api/v1/uploads")
      .set("Authorization", `Bearer ${instructorToken}`)
      .attach("file", Buffer.from("plain text"), { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/unsupported file type/i);
  });

  it("rejects requests without a file", async () => {
    const res = await request(app).post("/api/v1/uploads").set("Authorization", `Bearer ${instructorToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no file/i);
  });
});
