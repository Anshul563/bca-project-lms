import "dotenv/config";

import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { hashPassword } from "../utils/crypto.js";
import { InstructorApplicationModel } from "../modules/users/instructorApplication.model.js";
import { UserModel } from "../modules/users/user.model.js";
import { logger } from "../utils/logger.js";

/**
 * Seeds demo data. Safe to run repeatedly: existing accounts are left alone.
 * Extend this script per phase as more modules land (categories, courses...).
 */
async function seed(): Promise<void> {
  await connectDatabase();

  const seeded = [];

  const admin = await UserModel.findOneAndUpdate(
    { email: "admin@lms.local" },
    {
      $setOnInsert: {
        name: "Platform Admin",
        email: "admin@lms.local",
        passwordHash: await hashPassword("Admin123!"),
        role: "admin",
        emailVerified: true,
      },
    },
    { upsert: true, new: true },
  );
  if (admin) seeded.push(`admin: ${admin.email}`);

  const instructor = await UserModel.findOneAndUpdate(
    { email: "instructor@lms.local" },
    {
      $setOnInsert: {
        name: "Priya Sharma",
        email: "instructor@lms.local",
        passwordHash: await hashPassword("Instructor123!"),
        role: "instructor",
        emailVerified: true,
        bio: "Senior full-stack engineer teaching modern web development.",
      },
    },
    { upsert: true, new: true },
  );
  if (instructor) {
    await InstructorApplicationModel.findOneAndUpdate(
      { user: instructor._id },
      {
        $setOnInsert: {
          user: instructor._id,
          bio: "Senior full-stack engineer teaching modern web development.",
          status: "approved",
          reviewedAt: new Date(),
        },
      },
      { upsert: true },
    );
    await InstructorApplicationModel.updateOne(
      { user: instructor._id, reviewedBy: { $exists: false } },
      { $set: { reviewedBy: admin?._id } },
    );
    seeded.push(`instructor: ${instructor.email}`);
  }

  const student = await UserModel.findOneAndUpdate(
    { email: "student@lms.local" },
    {
      $setOnInsert: {
        name: "Rahul Verma",
        email: "student@lms.local",
        passwordHash: await hashPassword("Student123!"),
        role: "student",
        emailVerified: true,
      },
    },
    { upsert: true, new: true },
  );
  if (student) seeded.push(`student: ${student.email}`);

  logger.info({ count: seeded.length, accounts: seeded }, "Seed complete");
}

seed()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ error }, "Seed failed");
    await disconnectDatabase();
    process.exit(1);
  });
