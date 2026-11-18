"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AdminConsole } from "@/features/admin/admin-console";

export default function AdminPage() {
  return (
    <AuthGuard allow={["admin"]}>
      <AdminConsole />
    </AuthGuard>
  );
}
