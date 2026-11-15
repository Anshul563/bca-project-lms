import "dotenv/config";

import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { hashPassword } from "../utils/crypto.js";
import { InstructorApplicationModel } from "../modules/users/instructorApplication.model.js";
import { UserModel } from "../modules/users/user.model.js";
import { CategoryModel } from "../modules/categories/category.model.js";
import { CourseModel } from "../modules/courses/course.model.js";
import { LessonModel } from "../modules/courses/lesson.model.js";
import { SectionModel } from "../modules/courses/section.model.js";
import { logger } from "../utils/logger.js";

interface SeedSummary {
  admin: string;
  instructor: string;
  student: string;
  categories: number;
  courses: number;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedCategories(): Promise<number> {
  const names = ["Web Development", "Data Science", "Design", "Business"];
  let created = 0;
  for (const name of names) {
    const slug = slugify(name);
    const existing = await CategoryModel.findOne({ slug });
    if (!existing) {
      await CategoryModel.create({ name, slug, description: `${name} courses` });
      created += 1;
    }
  }
  return created;
}

async function seedDemoCourse(instructorId: string, categoryId: string): Promise<boolean> {
  const slug = "modern-web-development-bootcamp";
  const existing = await CourseModel.exists({ slug });
  if (existing) {
    return false;
  }

  const course = await CourseModel.create({
    title: "Modern Web Development Bootcamp",
    slug,
    subtitle: "HTML, CSS, JavaScript and React — from zero to deployed apps",
    description:
      "A hands-on bootcamp covering modern front-end development. You will build real projects, learn industry tooling, and finish with a portfolio-ready capstone. Every module combines short videos with exercises so you can apply concepts immediately.",
    categoryId,
    level: "beginner",
    language: "English",
    price: 0,
    tags: ["javascript", "react", "html", "css"],
    requirements: ["A computer with a modern browser", "No prior coding experience required"],
    learningOutcomes: [
      "Build responsive web pages with HTML and CSS",
      "Program confidently in modern JavaScript",
      "Create component-driven apps with React",
      "Deploy a full project to production",
    ],
    instructor: instructorId,
    status: "published",
    publishedAt: new Date(),
  });

  const section1 = await SectionModel.create({ course: course._id, title: "Getting started", order: 0 });
  const section2 = await SectionModel.create({ course: course._id, title: "JavaScript essentials", order: 1 });

  await LessonModel.insertMany([
    {
      course: course._id,
      section: section1._id,
      title: "Welcome to the bootcamp",
      type: "video",
      videoUrl: "https://storage.lms.local/demo/welcome.mp4",
      durationMinutes: 5,
      isFreePreview: true,
      order: 0,
    },
    {
      course: course._id,
      section: section1._id,
      title: "How the web works",
      type: "article",
      content:
        "The web is built on request/response: your browser sends an HTTP request, a server responds with resources...\n\n(Seeded sample content for the demo course.)",
      durationMinutes: 10,
      isFreePreview: true,
      order: 1,
    },
    {
      course: course._id,
      section: section2._id,
      title: "Variables and functions",
      type: "video",
      videoUrl: "https://storage.lms.local/demo/js-basics.mp4",
      durationMinutes: 18,
      isFreePreview: false,
      order: 0,
    },
    {
      course: course._id,
      section: section2._id,
      title: "Further reading",
      type: "link",
      externalUrl: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      durationMinutes: 15,
      isFreePreview: false,
      order: 1,
    },
  ]);

  await CourseModel.updateOne(
    { _id: course._id },
    { $set: { totalDurationMinutes: 5 + 10 + 18 + 15, enrollmentCount: 2 } },
  );
  return true;
}

async function seed(): Promise<SeedSummary> {
  await connectDatabase();

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
          reviewedBy: admin?._id,
          reviewedAt: new Date(),
        },
      },
      { upsert: true },
    );
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

  const categoryCount = await seedCategories();
  const webDev = await CategoryModel.findOne({ slug: "web-development" });
  const courseCreated =
    webDev && instructor ? await seedDemoCourse(String(instructor._id), String(webDev._id)) : false;

  return {
    admin: admin?.email ?? "admin@lms.local",
    instructor: instructor?.email ?? "instructor@lms.local",
    student: student?.email ?? "student@lms.local",
    categories: categoryCount,
    courses: courseCreated ? 1 : 0,
  };
}

seed()
  .then(async (summary) => {
    logger.info(
      {
        accounts: [summary.admin, summary.instructor, summary.student],
        newCategories: summary.categories,
        newCourses: summary.courses,
        passwords: {
          admin: "Admin123!",
          instructor: "Instructor123!",
          student: "Student123!",
        },
      },
      "Seed complete (dev credentials shown — do not use in production)",
    );
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ error }, "Seed failed");
    await disconnectDatabase();
    process.exit(1);
  });
