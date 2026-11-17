"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CircleX, ListChecks, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { PublicCourseDetail, PublicQuiz, QuizAttemptResult, QuizAttemptSummary } from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiFetch, tryApi } from "@/lib/api-client";
import type { Route } from "next";

interface QuizRunnerProps {
  slug: string;
}

export function QuizRunner({ slug }: QuizRunnerProps) {
  const queryClient = useQueryClient();
  // courseId comes from the public course detail (quiz endpoints key on it).
  const detailQuery = useQuery({
    queryKey: ["course", slug],
    queryFn: () => apiFetch<PublicCourseDetail>(`/courses/${slug}`),
    retry: false,
  });

  const courseId = detailQuery.data?.id;
  const quizQuery = useQuery({
    queryKey: ["quiz", courseId],
    queryFn: () => apiFetch<PublicQuiz>(`/courses/id/${courseId}/quiz`),
    enabled: courseId !== undefined,
    retry: false,
  });

  const historyQuery = useQuery({
    queryKey: ["quiz-attempts", courseId],
    queryFn: () => apiFetch<QuizAttemptSummary[]>(`/courses/id/${courseId}/quiz/attempts/my`),
    enabled: courseId !== undefined,
    retry: false,
  });

  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const submitMutation = useMutation({
    mutationFn: (answers: { questionId: string; selectedOptionIds: string[] }[]) =>
      tryApi<QuizAttemptResult>(`/courses/id/${courseId}/quiz/attempts`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),
  });

  if (detailQuery.isPending) {
    return <div className="h-96 animate-pulse rounded-lg bg-muted" aria-busy="true" />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <p role="alert" className="text-sm text-destructive">Course not found.</p>;
  }

  if (quizQuery.isError) {
    const status = quizQuery.error instanceof Error ? (quizQuery.error as { status?: number }).status : undefined;
    if (status === 403) {
      return (
        <Card className="mx-auto max-w-md">
          <CardContent className="grid place-items-center gap-3 p-8 text-center">
            <ListChecks className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Enroll in this course to take the quiz</p>
            <Button asChild>
              <Link href={`/courses/${slug}` as Route}>Back to course</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (status === 404) {
      return (
        <Card className="mx-auto max-w-md">
          <CardContent className="grid place-items-center gap-3 p-8 text-center">
            <ListChecks className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">This course has no quiz yet.</p>
            <Button asChild variant="outline">
              <Link href={`/courses/${slug}` as Route}>Back to course</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }
    return <p role="alert" className="text-sm text-destructive">Failed to load the quiz.</p>;
  }

  if (quizQuery.data === undefined) {
    return <div className="h-96 animate-pulse rounded-lg bg-muted" aria-busy="true" />;
  }

  const quiz = quizQuery.data;

  function toggleOption(questionId: string, optionId: string, multiple: boolean) {
    if (result) {
      return; // locked while showing results
    }
    setSelected((previous) => {
      const current = previous[questionId] ?? [];
      if (!multiple) {
        return { ...previous, [questionId]: current[0] === optionId ? [] : [optionId] };
      }
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...previous, [questionId]: next };
    });
  }

  async function onSubmit() {
    const answers = quiz.questions.map((question) => ({
      questionId: question.id,
      selectedOptionIds: selected[question.id] ?? [],
    }));
    const outcome = await submitMutation.mutateAsync(answers);
    if (!outcome.ok) {
      if (outcome.error.status === 401) {
        toast.error("Please sign in again to submit your attempt.");
        return;
      }
      toast.error(outcome.error.message);
      return;
    }
    setResult(outcome.data);
    void queryClient.invalidateQueries({ queryKey: ["quiz-attempts", courseId] });
    toast.success(outcome.data.passed ? `Passed with ${outcome.data.scorePercent}%!` : `Scored ${outcome.data.scorePercent}% — try again!`);
  }

  function onRetake() {
    setResult(null);
    setSelected({});
  }

  const answeredCount = quiz.questions.filter((question) => (selected[question.id] ?? []).length > 0).length;

  return (
    <div className="grid gap-6">
      <Link
        href={`/courses/${slug}` as Route}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to course
      </Link>

      <header className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground">
          {quiz.questions.length} questions · pass mark {quiz.passScore}% · retakes allowed
        </p>
      </header>

      {result ? (
        <Card className={result.passed ? "border-emerald-500/40" : "border-amber-500/40"}>
          <CardContent className="grid place-items-center gap-2 p-8 text-center">
            {result.passed ? (
              <CheckCircle2 className="size-10 text-emerald-500" aria-hidden />
            ) : (
              <CircleX className="size-10 text-amber-500" aria-hidden />
            )}
            <p className="text-3xl font-bold">{result.scorePercent}%</p>
            <p className="text-sm text-muted-foreground">
              {result.earnedPoints}/{result.totalPoints} points · {result.passed ? "Passed" : `Needs ${result.passScore}% to pass`}
            </p>
            <p className="text-xs text-muted-foreground">
              {result.perQuestion.filter((entry) => entry.correct).length} of {result.perQuestion.length} answers correct
            </p>
            <Button variant="outline" onClick={onRetake} className="mt-2">
              <RefreshCw className="size-4" aria-hidden />
              Retake quiz
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        {quiz.questions.map((question, index) => {
          const multiple = question.type === "multiple_choice";
          const chosen = selected[question.id] ?? [];
          const perQuestion = result?.perQuestion.find((entry) => entry.questionId === question.id);
          return (
            <Card key={question.id}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">
                  {index + 1}. {question.text}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({question.points} {question.points === 1 ? "point" : "points"}{multiple ? " · multiple answers" : ""})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 p-4 pt-0">
                <fieldset className="grid gap-2" disabled={result !== null}>
                  <legend className="sr-only">{question.text}</legend>
                  {question.options.map((option) => (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/60 ${
                        chosen.includes(option.id) ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <input
                        type={multiple ? "checkbox" : "radio"}
                        name={question.id}
                        checked={chosen.includes(option.id)}
                        onChange={() => toggleOption(question.id, option.id, multiple)}
                        className="accent-primary"
                      />
                      {option.text}
                    </label>
                  ))}
                </fieldset>
                {perQuestion ? (
                  <p className={`text-xs font-medium ${perQuestion.correct ? "text-emerald-600" : "text-red-600"}`}>
                    {perQuestion.correct ? "Correct" : "Incorrect"}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}

        {!result ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {answeredCount}/{quiz.questions.length} answered
            </span>
            <Button type="submit" disabled={submitMutation.isPending || answeredCount === 0}>
              {submitMutation.isPending ? "Submitting…" : "Submit answers"}
            </Button>
          </div>
        ) : null}
      </form>

      {historyQuery.data && historyQuery.data.length > 0 ? (
        <section aria-labelledby="attempt-history" className="grid gap-2">
          <h2 id="attempt-history" className="font-semibold">
            Your attempts
          </h2>
          <Separator />
          <ul className="grid gap-1.5">
            {historyQuery.data.map((attempt) => (
              <li key={attempt.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                <span className="text-muted-foreground">{new Date(attempt.submittedAt).toLocaleString()}</span>
                <span className={attempt.passed ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
                  {attempt.scorePercent}% · {attempt.passed ? "Passed" : "Failed"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
