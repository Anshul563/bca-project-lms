import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-12">
      <Link href="/" className="text-xl font-bold tracking-tight">
        LMS
      </Link>
      {children}
    </div>
  );
}
