"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  changePasswordBodySchema,
  instructorApplicationBodySchema,
  updateProfileBodySchema,
  type PublicUser,
} from "@lms/shared";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { tryApi } from "@/lib/api-client";
import { useSession } from "@/lib/auth";

type ProfileValues = z.infer<typeof updateProfileBodySchema>;
type PasswordValues = z.infer<typeof changePasswordBodySchema>;
type ApplicationValues = z.infer<typeof instructorApplicationBodySchema>;

function ProfileSection({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(updateProfileBodySchema),
    defaultValues: { name: user.name, bio: user.bio ?? "" },
  });

  const saveMutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      tryApi<PublicUser>("/users/me", { method: "PATCH", body: values }),
  });

  async function onSubmit(values: ProfileValues) {
    const result = await saveMutation.mutateAsync(values);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Profile updated");
    queryClient.setQueryData(["me"], result.data);
    void queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How other learners and instructors see you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" autoComplete="name" {...register("name")} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="profile-bio">Bio</Label>
            <textarea
              id="profile-bio"
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="A short introduction…"
              {...register("bio")}
            />
            {errors.bio ? <p className="text-xs text-destructive">{errors.bio.message}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user.email} disabled />
            <p className="text-xs text-muted-foreground">Email address changes require support assistance.</p>
          </div>
          <Button type="submit" className="w-fit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordSection() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordBodySchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const changeMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      tryApi<null>("/auth/change-password", { method: "POST", body: values }),
  });

  async function onSubmit(values: PasswordValues) {
    const result = await changeMutation.mutateAsync(values);
    if (!result.ok) {
      setError("currentPassword", { message: result.error.code === "WRONG_PASSWORD" ? result.error.message : undefined });
      if (result.error.code !== "WRONG_PASSWORD") {
        toast.error(result.error.message);
      }
      return;
    }
    toast.success("Password changed. Other devices have been signed out.");
    reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Changing your password signs you out everywhere except this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input id="current-password" type="password" autoComplete="current-password" {...register("currentPassword")} />
            {errors.currentPassword ? (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" {...register("newPassword")} />
            {errors.newPassword ? <p className="text-xs text-destructive">{errors.newPassword.message}</p> : null}
          </div>
          <Button type="submit" className="w-fit" variant="outline">
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function InstructorSection() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationValues>({
    resolver: zodResolver(instructorApplicationBodySchema),
    defaultValues: { bio: "" },
  });

  const applyMutation = useMutation({
    mutationFn: (values: ApplicationValues) =>
      tryApi<{ status: string }>("/auth/apply-instructor", { method: "POST", body: values }),
  });

  async function onSubmit(values: ApplicationValues) {
    const result = await applyMutation.mutateAsync(values);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Application submitted! An admin will review it shortly.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Become an instructor</CardTitle>
        <CardDescription>
          Tell us about your expertise. Approved instructors can create and publish courses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="application-bio">Professional bio</Label>
            <textarea
              id="application-bio"
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="What do you teach, and what experience do you bring?"
              {...register("bio")}
            />
            {errors.bio ? <p className="text-xs text-destructive">{errors.bio.message}</p> : null}
          </div>
          <Button type="submit" className="w-fit" disabled={applyMutation.isPending}>
            {applyMutation.isPending ? "Submitting…" : "Submit application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SettingsContent() {
  const { user } = useSession();

  if (!user) {
    return null;
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile, security and instructor status.</p>
      </div>
      <ProfileSection user={user} />
      <Separator />
      <PasswordSection />
      {user.role === "student" ? (
        <>
          <Separator />
          <InstructorSection />
        </>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
