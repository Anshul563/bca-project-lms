import { ArrowRight, BadgeCheck, BookOpen, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Structured curriculum",
    description: "Sections and lessons in video, article and PDF formats with resume-from-where-you-left tracking.",
  },
  {
    icon: BadgeCheck,
    title: "Quizzes & certificates",
    description: "Pass course assessments and earn verifiable certificates you can share.",
  },
  {
    icon: Users,
    title: "Learn with the best",
    description: "Instructor-verified experts publish courses after an admin review process.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    description: "Role-based access, rotating sessions, and rate-limited authentication.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-gradient-to-b from-muted/60 to-background">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-4 py-24 text-center">
            <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              New · Instructor-led courses with certificates
            </span>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Learn anything, anywhere — at your own pace
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Discover expert-built courses, follow structured curricula, complete quizzes, and earn
              verifiable certificates that prove your progress.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/courses">
                  Browse courses
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/register">Create free account</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features-heading" className="mx-auto w-full max-w-7xl px-4 py-16">
          <h2 id="features-heading" className="sr-only">
            Features
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-lg border bg-card p-6 shadow-sm">
                <feature.icon className="mb-3 size-6 text-primary" aria-hidden />
                <h3 className="mb-1.5 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 py-16 text-center">
            <h2 className="text-2xl font-bold tracking-tight">Ready to start learning?</h2>
            <p className="max-w-xl text-muted-foreground">
              Join today — enroll in free courses instantly, or become an instructor and share what you know.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/courses">Explore catalog</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/register">Become an instructor</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-8">
        <div className="mx-auto w-full max-w-7xl px-4 text-sm text-muted-foreground">
          © {new Date().getFullYear()} LMS. Built as a full-stack learning platform.
        </div>
      </footer>
    </div>
  );
}
