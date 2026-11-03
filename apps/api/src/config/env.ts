import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  WEB_URL: z.string().url().default("http://localhost:3000"),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(7),
  COOKIE_SECURE: z
    .union([z.enum(["true", "false"]), z.boolean()])
    .default("false")
    .transform((value) => value === true || value === "true"),
  COOKIE_DOMAIN: z.string().optional(),

  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().min(10).default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(5).default(20),

  STORAGE_PROVIDER: z.enum(["local", "cloudinary"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default("./uploads"),
  LOCAL_STORAGE_PUBLIC_URL_PREFIX: z.string().default("/uploads"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("LMS <no-reply@lms.local>"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  // Logging may not be usable yet, and exiting before the logger is available
  // is acceptable here: this only runs once at process boot.
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const data = parsed.data;

/** Secrets used to sign tokens must be strong in any deployed environment. */
if (data.NODE_ENV === "production") {
  const weakSecrets = Object.entries({
    JWT_ACCESS_SECRET: data.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: data.JWT_REFRESH_SECRET,
  }).filter(([, value]) => value.length < 32 || /^(replace|change)/i.test(value));

  if (weakSecrets.length > 0) {
    console.error(
      `Refusing to start: weak JWT secrets (${weakSecrets.map(([key]) => key).join(", ")}). Set 32+ random characters.`,
    );
    process.exit(1);
  }
}

export const env = {
  ...data,
  isProduction: data.NODE_ENV === "production",
  isTest: data.NODE_ENV === "test",
  corsOrigins: data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;
