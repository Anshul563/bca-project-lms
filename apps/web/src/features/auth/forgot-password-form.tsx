"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { forgotPasswordBodySchema } from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tryApi } from "@/lib/api-client";

type ForgotValues = z.infer<typeof forgotPasswordBodySchema>;

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordBodySchema),
    defaultValues: { email: "" },
  });

  const forgotMutation = useMutation({
    mutationFn: (values: ForgotValues) =>
      tryApi<null>("/auth/forgot-password", { method: "POST", body: values }),
  });

  async function onSubmit(values: ForgotValues) {
    const result = await forgotMutation.mutateAsync(values);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("If that email is registered, a reset link has been sent.");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>We will email you a link to set a new password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>
          <Button type="submit" disabled={isSubmitting || forgotMutation.isPending}>
            {forgotMutation.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
