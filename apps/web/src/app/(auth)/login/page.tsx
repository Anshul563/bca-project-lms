import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to continue your learning journey.",
};

export default function LoginPage() {
  return (
    <main aria-label="Sign in">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
