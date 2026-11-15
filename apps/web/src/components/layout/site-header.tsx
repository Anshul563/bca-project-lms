"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Settings, GraduationCap, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UserRole } from "@lms/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, useSession } from "@/lib/auth";

const DASHBOARD_BY_ROLE: Record<UserRole, string> = {
  student: "/student",
  instructor: "/instructor",
  admin: "/admin",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function SiteHeader() {
  const { user, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useLogout();

  async function onLogout() {
    await logout.mutateAsync();
    void queryClient.invalidateQueries({ queryKey: ["me"] });
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <GraduationCap className="size-5 text-primary" aria-hidden />
            <span>LMS</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-4 text-sm font-medium sm:flex">
            <Link href="/courses" className="text-muted-foreground transition-colors hover:text-foreground">
              Courses
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {status === "loading" ? (
            <div aria-hidden className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="size-7">
                    {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{user.name}</span>
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={DASHBOARD_BY_ROLE[user.role]}>
                    <LayoutDashboard aria-hidden />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings aria-hidden />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => void onLogout()}>
                  <LogOut aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
