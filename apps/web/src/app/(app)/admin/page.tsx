"use client";

import { ShieldCheck } from "lucide-react";

import { AuthGuard } from "@/components/auth/auth-guard";

function AdminOverview() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin console</h1>
        <p className="text-muted-foreground">Platform overview and moderation tooling.</p>
      </div>
      <div className="grid place-items-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <ShieldCheck className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">Moderation queue coming in the next phase</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Instructor application reviews and course publish approvals run through this console. The
          API endpoints are live; the management UI lands with the admin phase.
        </p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard allow={["admin"]}>
      <AdminOverview />
    </AuthGuard>
  );
}
