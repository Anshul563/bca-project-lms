import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { setupTestDatabase, teardownTestDatabase } from "./helpers/database.js";

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  await setupTestDatabase();
  app = createApp();
});

afterAll(teardownTestDatabase);

describe("operational health", () => {
  it("reports liveness plus a connected database", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: "ok",
      database: "connected",
      env: "test",
    });
    expect(typeof res.body.data.uptimeSeconds).toBe("number");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("returns the standard 404 envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.message).toBe("string");
  });

  it("sets baseline security headers on API responses", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
