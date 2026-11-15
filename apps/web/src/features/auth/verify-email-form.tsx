"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { verifyEmailBodySchema } from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tryApi } from "@/lib/api-client";

type VerifyValues = z.infer<typeof verifyEmailBodySchema>;

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VerifyValues>({
    resolver: zodResolver(verifyEmailBodySchema),
    defaultValues: { token: tokenFromUrl },
  });

  const verifyMutation = useMutation({
    mutationFn: (values: VerifyValues) => tryApi<null>("/auth/verify-email", { method: "POST", body: values }),
  });

  async function onSubmit(values: VerifyValues) {
    const result = await verifyMutation.mutateAsync(values);
    if (!result.ok) {
      setError("root", { message: result.error.message });
      return;
    }
    toast.success("Email verified. Enjoy your courses!");
    router.replace("/courses");
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Verify your email</CardTitle>
        <CardDescription>
          {tokenFromUrl ? "Click the button below to confirm your address." : "Paste the token from your email below."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="grid gap-4" noValidate>
          {!tokenFromUrl ? (
            <div className="grid gap-1.5">
              <Label htmlFor="token">Token</Label>
              <Input id="token" {...register("token")} />
              {errors.token ? <p className="text-xs text-destructive">{errors.token.message}</p> : null}
            </div>
          ) : (
            <input type="hidden" {...register("token")} />
          )}
          {errors.root ? <p className="text-sm text-destructive">{errors.root.message}</p> : null}
          <Button type="submit" disabled={verifyMutation.isPending}>
            {verifyMutation.isPending ? "Verifying…" : "Verify email"}
          </Button>
          <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
