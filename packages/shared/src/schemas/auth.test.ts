import { describe, expect, it } from "vitest";

import { loginBodySchema, registerBodySchema } from "./auth.js";

describe("auth schemas", () => {
  it("normalizes email case and surrounding whitespace", () => {
    const result = registerBodySchema.parse({
      name: "Anshul",
      email: "  Anshul@Example.COM ",
      password: "Str0ngPassw0rd",
    });
    expect(result.email).toBe("anshul@example.com");
  });

  it("rejects weak passwords with per-rule messages", () => {
    const result = registerBodySchema.safeParse({
      name: "Anshul",
      email: "anshul@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed emails", () => {
    const result = loginBodySchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });
});
