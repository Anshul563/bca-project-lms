"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, GraduationCap } from "lucide-react";
import Link from "next/link";
import type { PublicCertificate } from "@lms/shared";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import type { Route } from "next";

function CertificateCard({ certificate }: { certificate: PublicCertificate }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <Award className="mt-0.5 size-6 text-primary" aria-hidden />
          <div className="grid gap-0.5">
            <span className="font-medium">{certificate.course.title}</span>
            <span className="text-xs text-muted-foreground">
              Issued {new Date(certificate.issuedAt).toLocaleDateString()}
              {certificate.quizScorePercent !== undefined
                ? ` · Quiz ${certificate.quizScorePercent}%`
                : ""}
              {" · "}
              {certificate.lessonsCompleted}/{certificate.totalLessons} lessons
            </span>
            <span className="font-mono text-xs text-muted-foreground">{certificate.serial}</span>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/certificates/${certificate.serial}` as Route}>View certificate</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CertificatesContent() {
  const certificatesQuery = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () => apiFetch<PublicCertificate[]>("/certificates/my"),
    retry: false,
  });

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
        <p className="text-muted-foreground">
          Certificates are issued automatically when you complete a course (and pass its quiz, when one exists).
        </p>
      </header>

      {certificatesQuery.isPending ? (
        <div className="grid gap-3" aria-busy="true">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : certificatesQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load your certificates.
        </p>
      ) : certificatesQuery.data.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <GraduationCap className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">No certificates yet — complete a course to earn one.</p>
          <Button asChild>
            <Link href="/courses">Browse courses</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {certificatesQuery.data.map((certificate) => (
            <CertificateCard key={certificate.id} certificate={certificate} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CertificatesPage() {
  return (
    <AuthGuard>
      <CertificatesContent />
    </AuthGuard>
  );
}
