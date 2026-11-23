import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Flag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamSelect, FormSelect } from "@/components/mk/ui";
import { cn } from "@/lib/utils";
import { GradeBadge } from "@/components/mk/ui";
import { usePrefs, useT } from "@/lib/i18n";
import {
  EXAM_TYPES,
  examGoalProgress,
  formatAverage,
  formatCgpa,
  formatDelta,
  subjectGoalProgress,
  type ExamType,
  type GoalLetter,
} from "@/lib/grading";
import {
  hasAnyMarks,
  latestCountedMark,
  useGradebook,
  useProfile,
} from "@/lib/gradebook";
import { examChange, examSummary, latestExamWithData } from "@/lib/book-derived";
import { examHistory, focusAreas, subjectHighlights, subjectSeries } from "@/lib/dashboard-derived";
import {
  dateFor,
  examDateKey,
  loadSavedExamDates,
  localToday,
  nextExam,
  saveExamDate,
  type SavedExamDates,
} from "@/lib/exam-dates";
import { exportExamPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Papan pemuka · Dashboard — MarkahKu" },
      { name: "description", content: "Your marks, CGPA, upcoming exams and study goals at a glance." },
      { property: "og:title", content: "Dashboard — MarkahKu" },
      { property: "og:description", content: "Your marks, CGPA, upcoming exams and study goals at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const EXAM_COLORS: Record<ExamType, string> = {
  sumatif_1: "bg-violet-400",
  sumatif_2: "bg-cyan-400",
  uasa: "bg-primary",
};

function Dashboard() {
  const t = useT();
  const { lang } = usePrefs();
  const { data: book, isLoading } = useGradebook();
  const { data: profile } = useProfile();
  const [form, setForm] = useState<number | null>(null);
  const [exam, setExam] = useState<ExamType>("sumatif_1");
  const [compareExam, setCompareExam] = useState<ExamType | "all">("all");
  const [dateOpen, setDateOpen] = useState(false);
  const [savedDates, setSavedDates] = useState<SavedExamDates>({});
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const today = localToday();
  const taskStorageKey = profile?.id ? `mk-dashboard-tasks:${profile.id}:${today}:${form ?? "current"}:${exam}` : "";

  useEffect(() => {
    if (form != null || !book) return;
    const latest = latestExamWithData(book);
    setForm(latest?.form ?? profile?.current_form ?? 1);
    if (latest) setExam(latest.exam);
  }, [book, profile, form]);

  useEffect(() => {
    setSavedDates(profile?.id ? loadSavedExamDates(profile.id) : {});
  }, [profile?.id]);

  useEffect(() => {
    if (!taskStorageKey) {
      setCompletedTasks({});
      return;
    }
    try {
      const value = localStorage.getItem(taskStorageKey);
      const parsed = value ? (JSON.parse(value) as unknown) : {};
      setCompletedTasks(parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {});
    } catch {
      setCompletedTasks({});
    }
  }, [taskStorageKey]);

  if (isLoading || !book || form == null) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-48 rounded-3xl" />
        <div className="grid gap-4 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-48 rounded-3xl" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {[0, 1].map((item) => <Skeleton key={item} className="h-64 rounded-3xl" />)}
        </div>
      </div>
    );
  }

  const currentForm = profile?.current_form ?? form;
  const summary = examSummary(book, form, exam);
  const change = examChange(book, form, exam);
  const empty = !hasAnyMarks(book);
  const highlights = subjectHighlights(book, form, exam, lang);
  const focus = focusAreas(book, form, exam, lang);
  const history = examHistory(book);
  const withMarks = new Set(
    book.sessions
      .filter((session) => examSummary(book, session.form, session.exam).counted > 0)
      .map((session) => examDateKey(session.form, session.exam)),
  );
  const upcoming = nextExam({
    today,
    currentForm,
    saved: savedDates,
    withMarks,
  });
  const dateForm = upcoming?.form ?? currentForm;
  const dateYear = dateForm === currentForm ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) + 1;
  const series = subjectSeries(book, form, lang, (name) => name.length > 14 ? `${name.slice(0, 13)}…` : name);
  const subjectGoalRows = book.goals
    .filter((goal) => goal.form === form && goal.scope === "subject" && goal.target_grade)
    .map((goal) => {
      const latest = goal.user_subject_id ? latestCountedMark(book, form, goal.user_subject_id) : null;
      const progress = subjectGoalProgress(latest, goal.target_grade as GoalLetter);
      return { goal, progress };
    });
  const metSubjectGoals = subjectGoalRows.filter((row) => row.progress.met).length;
  const examGoal = book.goals.find((goal) => goal.form === form && goal.scope === "exam" && goal.exam === exam);
  const targetCgpa = examGoal?.target_cgpa == null ? null : Number(examGoal.target_cgpa);
  const cgpaProgress = targetCgpa == null ? null : examGoalProgress(summary.cgpa, targetCgpa);
  const studySubject = highlights.worst?.name ?? highlights.best?.name ?? t("common.subject");
  const studyTasks = [
    focus[0]
      ? { id: "focus", label: t("dash.studyFocus", { subject: focus[0].name, grade: focus[0].letter }) }
      : { id: "focus", label: t("dash.studyReview", { subject: studySubject }) },
    { id: "practice", label: t("dash.studyPractice", { subject: studySubject }) },
    { id: "explain", label: t("dash.studyExplain", { subject: studySubject }) },
  ];
  const taskCount = studyTasks.length;
  const doneCount = studyTasks.filter((task) => completedTasks[task.id]).length;

  const toggleTask = (id: string, checked: boolean) => {
    const next = { ...completedTasks, [id]: checked };
    setCompletedTasks(next);
    if (taskStorageKey) {
      try {
        localStorage.setItem(taskStorageKey, JSON.stringify(next));
      } catch {
        // The checklist still works for this page view if storage is unavailable.
      }
    }
  };

  const updateExamDate = (targetExam: ExamType, date: string | null) => {
    if (!profile?.id) return;
    try {
      setSavedDates(saveExamDate(profile.id, dateForm, targetExam, date));
    } catch {
      // Leave the date unchanged when browser storage is unavailable.
    }
  };

  const examDate = upcoming
    ? new Intl.DateTimeFormat(lang === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short", year: "numeric" })
        .format(new Date(`${upcoming.date}T00:00:00`))
    : "";
  const countdown = upcoming
    ? upcoming.daysLeft === 0
      ? t("dash.today")
      : upcoming.daysLeft === 1
        ? t("dash.tomorrow")
        : t("dash.inDays", { n: upcoming.daysLeft })
    : "";

  return (
    <>
      <section className="relative isolate mb-6 overflow-hidden rounded-3xl border border-border/70 bg-card/60 p-5 shadow-glass sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 size-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <svg aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 hidden h-full w-[38%] text-primary/20 md:block" viewBox="0 0 360 180" fill="none" preserveAspectRatio="xMaxYMax meet">
          <path d="M18 180V95h28v85M58 180V68h38v112M104 180V110h26v70M140 180V42h42v138M190 180V86h30v94M228 180V58h48v122M284 180V102h30v78M322 180V74h22v106" stroke="currentColor" strokeWidth="2" />
          <path d="M14 136h338M14 158h338M140 62h42M228 80h48" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
          <circle cx="160" cy="52" r="28" stroke="currentColor" strokeWidth="1" />
        </svg>
        <div className="relative z-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{t("common.year")} · {new Date().getFullYear()}</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {profile?.display_name?.trim()
                  ? t("dash.welcome", { name: profile.display_name.trim() })
                  : t("dash.welcomeNoName")}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {t("common.formN", { n: currentForm })}
                </span>
                {profile?.school && (
                  <span className="max-w-full truncate rounded-full border border-border/70 bg-background/35 px-3 py-1.5 text-xs text-muted-foreground">
                    {profile.school}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FormSelect value={form} onChange={setForm} />
              <ExamSelect value={exam} onChange={setExam} />
              <Button
                variant="outline"
                onClick={() => exportExamPdf(book, form, exam, lang)}
                disabled={summary.counted === 0}
              >
                <Download />
                {t("common.exportPdf")}
              </Button>
              <Button asChild variant="hero">
                <Link to="/quick-add">
                  <ClipboardList />
                  {t("dash.enterMarks")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {empty ? (
        <Card className="relative overflow-hidden rounded-3xl border-primary/20">
          <CardContent className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="pointer-events-none absolute -left-12 -top-16 size-52 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <Sparkles className="size-6" />
              </div>
              <div className="max-w-xl">
                <h2 className="text-xl font-semibold">{t("dash.getStarted")}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("dash.getStartedSub")}</p>
              </div>
            </div>
            <div className="relative flex flex-wrap gap-2">
              <Button asChild variant="hero">
                <Link to="/exams"><ClipboardList />{t("dash.enterMarks")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/import"><Upload />{t("dash.importResults")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label={t("dash.perf")} className="mb-6 grid gap-4 xl:grid-cols-3">
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
                <div>
                  <CardTitle>{t("dash.cgpaNow")}</CardTitle>
                  <CardDescription className="mt-1">{t("common.formN", { n: form })} · {t(`exam.${exam}`)}</CardDescription>
                </div>
                <div
                  role="progressbar"
                  aria-label={t("dash.cgpaNow")}
                  aria-valuemin={0}
                  aria-valuemax={4}
                  aria-valuenow={summary.cgpa ?? 0}
                  className="relative grid size-20 shrink-0 place-items-center"
                >
                  <svg viewBox="0 0 40 40" className="size-20 -rotate-90">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/80" />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="100.53"
                      strokeDashoffset={100.53 - 100.53 * Math.max(0, Math.min(1, (summary.cgpa ?? 0) / 4))}
                      className="text-primary transition-[stroke-dashoffset] duration-700"
                    />
                  </svg>
                  <span className="absolute font-display text-lg font-bold tabular">{formatCgpa(summary.cgpa)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="font-display text-4xl font-bold tabular">{formatCgpa(summary.cgpa)}</span>
                  <span className="pb-1 text-sm text-muted-foreground">{t("dash.outOf4")}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {change.cgpa != null && change.cgpa > 0 ? (
                    <TrendingUp className="size-4 text-success" />
                  ) : change.cgpa != null && change.cgpa < 0 ? (
                    <TrendingDown className="size-4 text-destructive" />
                  ) : null}
                  <span className={change.cgpa == null ? "text-muted-foreground" : change.cgpa >= 0 ? "text-success" : "text-destructive"}>
                    {change.cgpa == null ? t("dash.noPrev") : formatDelta(change.cgpa, 2)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("dash.vsPrev")}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t("dash.perf")}</CardTitle>
                <CardDescription>{t("dash.overallAvg")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="font-display text-4xl font-bold tabular">{formatAverage(summary.average)}</div>
                <div className="mt-4 space-y-3">
                  {highlights.best ? (
                    <HighlightRow
                      icon={<TrendingUp className="size-4 text-success" />}
                      label={t("dash.best")}
                      name={highlights.best.name}
                      mark={highlights.best.mark}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("dash.noMarksExam")}</p>
                  )}
                  {highlights.worst && (
                    <HighlightRow
                      icon={<TrendingDown className="size-4 text-warning" />}
                      label={t("dash.worst")}
                      name={highlights.worst.name}
                      mark={highlights.worst.mark}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-cyan-400/10 blur-3xl" />
              <CardHeader className="relative flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div>
                  <CardTitle>{t("dash.upcoming")}</CardTitle>
                  <CardDescription className="mt-1">{t("common.formN", { n: upcoming?.form ?? currentForm })}</CardDescription>
                </div>
                <Button variant="glass" size="icon" aria-label={t("dash.setDate")} title={t("dash.setDate")} onClick={() => setDateOpen(true)}>
                  <CalendarDays />
                </Button>
              </CardHeader>
              <CardContent className="relative">
                {upcoming ? (
                  <>
                    <div className="font-display text-2xl font-bold">{t(`exam.${upcoming.exam}`)}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/15 px-3 py-1.5 text-sm font-semibold text-primary">{countdown}</span>
                      <span className="text-sm text-muted-foreground">{examDate}</span>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("size-1.5 rounded-full", upcoming.estimated ? "bg-warning" : "bg-success")} />
                      {t(upcoming.estimated ? "dash.estimated" : "dash.confirmed")}
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-24 items-center text-sm text-muted-foreground">{t("dash.noUpcoming")}</div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="mb-6 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
            <Card className="min-w-0">
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{t("dash.compare")}</CardTitle>
                  <CardDescription className="mt-1">{t("common.formN", { n: form })}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1 rounded-full border border-border/70 bg-background/30 p-1" role="group" aria-label={t("dash.compareFilter")}>
                  <CompareFilter active={compareExam === "all"} label={t("common.all")} onClick={() => setCompareExam("all")} />
                  <CompareFilter active={compareExam === "sumatif_1"} label="S1" onClick={() => setCompareExam("sumatif_1")} />
                  <CompareFilter active={compareExam === "sumatif_2"} label="S2" onClick={() => setCompareExam("sumatif_2")} />
                  <CompareFilter active={compareExam === "uasa"} label="UASA" onClick={() => setCompareExam("uasa")} />
                </div>
              </CardHeader>
              <CardContent>
                {series.length === 0 ? (
                  <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">{t("dash.noMarksExam")}</div>
                ) : (
                  <div role="img" aria-label={t("dash.compareAccessible", { values: series.map((row) => `${row.full}: ${EXAM_TYPES.map((type) => row[type] == null ? "—" : row[type]).join("/")}`).join(", ") })}>
                    <div className="mb-3 flex items-center gap-4 text-[10px] font-medium text-muted-foreground">
                      {EXAM_TYPES.map((type) => (
                        <span key={type} className="inline-flex items-center gap-1.5">
                          <span className={cn("size-2 rounded-full", EXAM_COLORS[type])} />
                          {type === "sumatif_1" ? "S1" : type === "sumatif_2" ? "S2" : "UASA"}
                        </span>
                      ))}
                    </div>
                    <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                      {series.map((row) => (
                        <div key={row.full} className="grid gap-2 border-b border-border/50 pb-3 last:border-0 sm:grid-cols-[9rem_1fr] sm:items-center">
                          <span className="truncate text-sm font-medium" title={row.full}>{row.full}</span>
                          <div className="space-y-1.5">
                            {EXAM_TYPES.filter((type) => compareExam === "all" || compareExam === type).map((type) => {
                              const mark = row[type];
                              return (
                                <div key={type} className="flex items-center gap-2">
                                  <span className="w-7 shrink-0 text-[10px] text-muted-foreground">{type === "sumatif_1" ? "S1" : type === "sumatif_2" ? "S2" : "UASA"}</span>
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/70">
                                    <div className={cn("h-full rounded-full transition-[width]", EXAM_COLORS[type])} style={{ width: `${Math.max(0, Math.min(100, mark ?? 0))}%` }} />
                                  </div>
                                  <span className="w-8 text-right font-mono text-xs tabular text-muted-foreground">{mark == null ? "—" : Math.round(mark)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-primary/20">
              <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-primary/15 blur-3xl" />
              <CardHeader className="relative">
                <div className="mb-1 flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <CardTitle>{t("dash.analysis")}</CardTitle>
                <CardDescription>{t("dash.openAnalyst")}</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                {highlights.best && (
                  <div className="rounded-2xl border border-success/20 bg-success/5 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-success">{t("dash.strengths")}</div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{highlights.best.name}</span>
                      <GradeBadge mark={highlights.best.mark} form={form} />
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded-2xl border border-warning/20 bg-warning/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-warning">{t("dash.focus")}</div>
                  {focus.length ? (
                    <div className="mt-1 space-y-1.5">
                      {focus.slice(0, 2).map((item) => (
                        <div key={item.name} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{item.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{t("dash.focusItem", { n: item.marksNeeded, grade: item.letter })}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">{highlights.worst?.name ?? t("dash.noFocus")}</p>
                  )}
                </div>
                <Button asChild variant="hero" className="mt-4 w-full">
                  <Link to="/analyst">{t("dash.openAnalyst")}<ArrowUpRight /></Link>
                </Button>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>{t("dash.history")}</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">{t("dash.historyEmpty")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="px-2 py-2 font-medium">{t("common.form")}</th>
                          <th className="px-2 py-2 font-medium">{t("dash.examCol")}</th>
                          <th className="px-2 py-2 text-right font-medium">{t("common.average")}</th>
                          <th className="px-2 py-2 text-right font-medium">{t("common.cgpa")}</th>
                          <th className="px-2 py-2 text-right font-medium">{t("dash.statusCol")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.slice(0, 5).map((row) => (
                          <tr key={row.session.id} className="border-b border-border/50 last:border-0">
                            <td className="px-2 py-2.5 text-muted-foreground">{t("common.formN", { n: row.session.form })}</td>
                            <td className="px-2 py-2.5 font-medium">{t(`exam.${row.session.exam}`)}</td>
                            <td className="px-2 py-2.5 text-right font-mono tabular">{formatAverage(row.average)}</td>
                            <td className="px-2 py-2.5 text-right font-mono tabular">{formatCgpa(row.cgpa)}</td>
                            <td className="px-2 py-2.5 text-right">
                              <span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-semibold", row.pending ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
                                {row.pending ? t("dash.pendingN", { n: row.pending }) : t("dash.complete")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>{t("dash.goal")}</CardTitle>
                  <CardDescription className="mt-1">{t("common.formN", { n: form })}</CardDescription>
                </div>
                <Flag className="size-5 text-primary" />
              </CardHeader>
              <CardContent>
                {cgpaProgress ? (
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{t("dash.targetCgpa")}</span>
                      <span className="font-mono text-sm font-semibold tabular">{formatCgpa(summary.cgpa)} / {formatCgpa(targetCgpa)}</span>
                    </div>
                    <Progress value={cgpaProgress.progress * 100} className="mt-2 h-2.5" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("dash.noExamGoal")}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">{t("dash.onTrack")}: {metSubjectGoals}</span>
                  <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">{t("dash.atRisk")}: {Math.max(0, subjectGoalRows.length - metSubjectGoals)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("dash.subjectGoalsMet", { m: metSubjectGoals, n: subjectGoalRows.length })}
                </p>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link to="/goals">{t("dash.goals")}<ArrowUpRight /></Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dash.tasks")}</CardTitle>
                <CardDescription>{t("dash.tasksDone", { d: doneCount, n: taskCount })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {studyTasks.map((task) => (
                  <label key={task.id} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 bg-background/25 p-3 transition-colors hover:bg-background/45", completedTasks[task.id] && "opacity-60")}>
                    <Checkbox
                      checked={!!completedTasks[task.id]}
                      onCheckedChange={(value) => toggleTask(task.id, value === true)}
                      aria-label={task.label}
                      className="mt-0.5 size-5 rounded-md"
                    />
                    <span className={cn("text-sm leading-5", completedTasks[task.id] && "line-through")}>{task.label}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      <Dialog open={dateOpen} onOpenChange={setDateOpen}>
        <DialogContent className="glass-strong max-h-[90svh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t("dash.dateTitle", { n: dateForm })}</DialogTitle>
            <DialogDescription>{t("dash.dateHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {EXAM_TYPES.map((dateExam) => {
              const currentDate = dateFor(dateForm, dateExam, dateYear, savedDates);
              const id = `exam-date-${dateForm}-${dateExam}`;
              return (
                <div key={dateExam} className="rounded-2xl border border-border/70 bg-background/30 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor={id} className="text-sm font-semibold">{t(`exam.${dateExam}`)}</label>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t(currentDate.estimated ? "dash.estimated" : "dash.confirmed")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id={id}
                      type="date"
                      value={currentDate.date}
                      onChange={(event) => updateExamDate(dateExam, event.target.value || null)}
                      className="min-w-0 flex-1"
                    />
                    {!currentDate.estimated && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => updateExamDate(dateExam, null)}>
                        {t("dash.useEstimate")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDateOpen(false)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HighlightRow({ icon, label, name, mark }: { icon: ReactNode; label: string; name: string; mark: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-background/25 px-3 py-2">
      {icon}
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      <span className="font-mono text-sm font-semibold tabular">{Math.round(mark)}</span>
    </div>
  );
}

function CompareFilter({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("min-h-9 rounded-full px-3 text-xs font-semibold transition-colors", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
    </button>
  );
}
