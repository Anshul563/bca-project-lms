import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { clearCollections, setupTestDatabase, teardownTestDatabase } from "./helpers/database.js";

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  await setupTestDatabase();
  app = createApp();
});

afterEach(clearCollections);

afterAll(teardownTestDatabase);

const registerPayload = {
  name: "Integration Student",
  email: "student@test.local",
  password: "Sup3rSecret",
};

function extractRefreshCookie(setCookie: string | string[] | undefined): string | undefined {
  if (!setCookie) {
    return undefined;
  }
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.find((cookie) => cookie.startsWith("lms_refresh_token="));
}

describe("auth flow", () => {
  it("registers a student and returns tokens + user", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(registerPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe("student@test.local");
    expect(res.body.data.user.role).toBe("student");
    expect(res.body.data.accessToken).toBeTruthy();
    expect(extractRefreshCookie(res.headers["set-cookie"])).toBeDefined();
  });

  it("rejects duplicate registration and weak passwords", async () => {
    await request(app).post("/api/v1/auth/register").send(registerPayload);

    const duplicate = await request(app).post("/api/v1/auth/register").send(registerPayload);
    expect(duplicate.status).toBe(409);

    const weak = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registerPayload, email: "other@test.local", password: "short" });
    expect(weak.status).toBe(422);
    expect(weak.body.errors.length).toBeGreaterThan(0);
  });

  it("logs in, exchanges refresh tokens (rotation), and revokes on logout", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registerPayload);
    const firstCookie = extractRefreshCookie(registered.headers["set-cookie"]);

    const login = await request(app).post("/api/v1/auth/login").send({
      email: registerPayload.email,
      password: registerPayload.password,
    });
    expect(login.status).toBe(200);
    expect(extractRefreshCookie(login.headers["set-cookie"])).toBeDefined();

    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", firstCookie ?? "");
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toBeTruthy();

    // Old refresh token must be invalidated by rotation.
    const replay = await request(app).post("/api/v1/auth/refresh").set("Cookie", firstCookie ?? "");
    expect(replay.status).toBe(401);

    const refreshedCookie = extractRefreshCookie(refresh.headers["set-cookie"]);
    const logout = await request(app).post("/api/v1/auth/logout").set("Cookie", refreshedCookie ?? "");
    expect(logout.status).toBe(200);

    const afterLogout = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshedCookie ?? "");
    expect(afterLogout.status).toBe(401);
  });

  it("returns the signed-in user's profile via /auth/me with RBAC middleware", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registerPayload);
    const { accessToken } = registered.body.data;

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(registerPayload.email);

    const anonymous = await request(app).get("/api/v1/auth/me");
    expect(anonymous.status).toBe(401);

    const garbage = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    expect(garbage.status).toBe(401);
  });

  it("updates the profile through PATCH /users/me", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registerPayload);
    const { accessToken } = registered.body.data;

    const updated = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Renamed Student", bio: "Testing bio" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Renamed Student");
    expect(updated.body.data.bio).toBe("Testing bio");

    const tooLong = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "x".repeat(1001) });
    expect(tooLong.status).toBe(422);
  });

  it("locks the account after repeated failed logins", async () => {
    await request(app).post("/api/v1/auth/register").send(registerPayload);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post("/api/v1/auth/login")
        .send({ email: registerPayload.email, password: "WrongPass1" });
    }

    const locked = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: registerPayload.email, password: registerPayload.password });
    expect(locked.status).toBe(429);
    expect(locked.body.message).toMatch(/locked/i);
  });

  it("supports the forgot/reset password round trip", async () => {
    const registered = await request(app).post("/api/v1/auth/register").send(registerPayload);

    const forgot = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: registerPayload.email });
    expect(forgot.status).toBe(200);
    // Response must not leak whether the account exists.
    const anonymous = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "nobody@test.local" });
    expect(anonymous.status).toBe(200);

    // Grab the reset token from the dev-mail log captured in the DB record.
    const { UserModel } = await import("../src/modules/users/user.model.js");
    const { createHash } = await import("node:crypto");
    const user = await UserModel.findOne({ email: registerPayload.email }).select(
      "+passwordResetTokenHash +passwordResetExpiresAt",
    );
    expect(user?.passwordResetTokenHash).toBeDefined();

    // We cannot reverse the hash; use service internals to mint a token the same way.
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("hex");
    const hashed = createHash("sha256").update(token).digest("hex");
    user!.passwordResetTokenHash = hashed;
    user!.passwordResetExpiresAt = new Date(Date.now() + 60_000);
    await user!.save();

    const reset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, password: "NewSup3rSecret" });
    expect(reset.status).toBe(200);

    const login = await request(app).post("/api/v1/auth/login").send({
      email: registerPayload.email,
      password: "NewSup3rSecret",
    });
    expect(login.status).toBe(200);
    void registered;
  });
});
