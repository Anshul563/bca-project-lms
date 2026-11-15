import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    fileParallelism: false,
    passWithNoTests: true,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "error",
      MONGO_URI: "mongodb://localhost:27017/lms_test",
      CORS_ORIGINS: "http://localhost:3000",
      WEB_URL: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-access-secret-0123456789abcdef0123456789abcdef",
      JWT_REFRESH_SECRET: "test-refresh-secret-0123456789abcdef0123456789abcdef",
      ACCESS_TOKEN_TTL_MINUTES: "5",
      REFRESH_TOKEN_TTL_DAYS: "1",
      COOKIE_SECURE: "false",
    },
  },
});
