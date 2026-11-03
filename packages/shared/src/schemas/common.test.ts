import { describe, expect, it } from "vitest";

import { listQuerySchema, paginationQuerySchema, slugSchema } from "./common.js";

describe("paginationQuerySchema", () => {
  it("applies defaults when fields are missing", () => {
    const result = paginationQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(12);
  });

  it("coerces numeric strings from query strings", () => {
    const result = paginationQuerySchema.parse({ page: "3", limit: "5" });
    expect(result).toEqual({ page: 3, limit: 5 });
  });

  it("rejects a limit above the configured maximum", () => {
    expect(() => paginationQuerySchema.parse({ limit: "999" })).toThrow();
  });
});

describe("listQuerySchema", () => {
  it("parses sort direction and keeps valid values only", () => {
    expect(listQuerySchema.parse({ sortDir: "desc" }).sortDir).toBe("desc");
    expect(() => listQuerySchema.parse({ sortDir: "sideways" })).toThrow();
  });
});

describe("slugSchema", () => {
  it("accepts hyphenated lowercase slugs and rejects others", () => {
    expect(slugSchema.safeParse("intro-to-nodejs").success).toBe(true);
    expect(slugSchema.safeParse("Intro Node").success).toBe(false);
  });
});
