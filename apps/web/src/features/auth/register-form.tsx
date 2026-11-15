"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { registerBodySchema } from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAccessToken, tryApi } from "@/lib/api-client";

type RegisterValues = z.infer<typeof registerBodySchema>;

export function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const registerMutation = useMutation({
    mutationFn: (values: RegisterValues) =>
      tryApi<{ accessToken: string }>("/auth/register", { method: "POST", body: values }),
  });

  async function onSubmit(values: RegisterValues) {
    const result = await registerMutation.mutateAsync(values);
    if (!result.ok) {
      if (result.error.fieldErrors.length > 0) {
        setError("root", { message: result.error.fieldErrors[0]?.message ?? result.error.message });
      } else {
        setError("root", { message: result.error.message });
      }
      toast.error(result.error.message);
      return;
    }
    setAccessToken(result.data.accessToken);
    void queryClient.invalidateQueries({ queryKey: ["me"] });
    toast.success("Welcome to LMS! Check your inbox to verify your email.");
    router.replace("/courses");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Start learning with expert-built courses.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              aria-invalid={errors.name ? "true" : undefined}
              {...register("name")}
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? "true" : undefined}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-xs text-destructive">
                {errors.password.message ?? "Use at least 8 characters with upper, lower and digits"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters, with upper &amp; lowercase letters and a digit.
              </p>
            )}
          </div>
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}
          <Button type="submit" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
