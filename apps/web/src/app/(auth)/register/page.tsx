import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a free account and start learning today.",
};

export default function RegisterPage() {
  return (
    <main aria-label="Create account">
      <RegisterForm />
    </main>
  );
}
