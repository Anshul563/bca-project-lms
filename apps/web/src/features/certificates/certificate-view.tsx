"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import type { PublicCertificate } from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

export function CertificateView({ serial }: { serial: string }) {
  const certificateQuery = useQuery({
    queryKey: ["certificate", serial],
    queryFn: () => apiFetch<PublicCertificate>(`/certificates/${encodeURIComponent(serial)}`),
    retry: false,
  });

  if (certificateQuery.isPending) {
    return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-xl bg-muted" aria-busy="true" />;
  }

  if (certificateQuery.isError || !certificateQuery.data) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="grid place-items-center gap-3 p-8 text-center">
          <Award className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Certificate not found</p>
          <p className="text-sm text-muted-foreground">
            Check the serial code — it looks like <code className="font-mono">LMS-2026-XXXXXXXX</code>.
          </p>
          <Button asChild variant="outline">
            <Link href="/certificates">My certificates</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const certificate = certificateQuery.data;

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link
          href="/certificates"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          My certificates
        </Link>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Print
        </Button>
      </div>

      <div className="rounded-2xl border-4 border-double border-primary/40 bg-card p-10 text-center shadow-sm print:border-primary">
        <Award className="mx-auto size-12 text-primary" aria-hidden />
        <p className="mt-4 text-xs font-semibold tracking-[0.25em] text-muted-foreground">
          CERTIFICATE OF COMPLETION
        </p>
        <p className="mt-6 text-sm text-muted-foreground">This certifies that</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{certificate.learner.name}</p>
        <p className="mt-5 text-sm text-muted-foreground">has successfully completed</p>
        <p className="mt-1 text-xl font-semibold">{certificate.course.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {certificate.lessonsCompleted} of {certificate.totalLessons} lessons
          {certificate.quizScorePercent !== undefined
            ? ` · final quiz ${certificate.quizScorePercent}%`
            : ""}
        </p>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4 text-left text-xs text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">{certificate.course.instructorName}</p>
            <p>Instructor</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-foreground">
              {new Date(certificate.issuedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p>Date issued</p>
          </div>
        </div>

        <p className="mt-8 border-t pt-3 font-mono text-xs text-muted-foreground">
          Verify at /certificates/{certificate.serial} · {certificate.serial}
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground print:hidden">
        Anyone with this serial can verify the certificate at its public link.
      </p>
    </div>
  );
}
