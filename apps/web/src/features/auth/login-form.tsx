"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { z as zod } from "zod";

import { loginBodySchema } from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAccessToken, tryApi } from "@/lib/api-client";

type LoginValues = z.infer<typeof loginBodySchema>;

const SUCCESS_MESSAGE = "Signed in";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: (values: LoginValues) =>
      tryApi<{ accessToken: string; user: { name: string } }>("/auth/login", {
        method: "POST",
        body: values,
      }),
  });

  async function onSubmit(values: LoginValues) {
    const result = await loginMutation.mutateAsync(values);
    if (!result.ok) {
      setError("root", { message: result.error.message });
      toast.error(result.error.message);
      return;
    }
    setAccessToken(result.data.accessToken);
    void queryClient.invalidateQueries({ queryKey: ["me"] });
    toast.success(SUCCESS_MESSAGE);
    const next = searchParams.get("next");
    router.replace(next && next.startsWith("/") ? next : "/courses");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>Enter your email and password to continue learning.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={errors.email ? "true" : undefined}
              {...register("email")}
            />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? "true" : undefined}
              {...register("password")}
            />
            {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
          </div>
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}
          <Button type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
