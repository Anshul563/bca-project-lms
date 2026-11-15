import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyEmailForm } from "@/features/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Verify email",
};

export default function VerifyEmailPage() {
  return (
    <main aria-label="Verify email">
      <Suspense>
        <VerifyEmailForm />
      </Suspense>
    </main>
  );
}
