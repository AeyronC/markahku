import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, Download, Rocket, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExamSelect, FormSelect, PageHeader, Stat, deltaTone } from "@/components/mk/ui";
import { GradeTable } from "@/components/mk/GradeTable";
import { TrendChart } from "@/components/mk/TrendChart";
import { GoalBars } from "@/components/mk/GoalBars";
import { usePrefs, useT } from "@/lib/i18n";
import { formatAverage, formatCgpa, formatDelta, rankTopPercent, type ExamType } from "@/lib/grading";
import { hasAnyMarks, sessionFor, useGradebook, useProfile } from "@/lib/gradebook";
import { examChange, examSummary, latestExamWithData } from "@/lib/book-derived";
import { exportExamPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Papan pemuka · Dashboard — MarkahKu" },
      { name: "description", content: "Your total, average, CGPA, subject grades, trend and goal progress at a glance." },
      { property: "og:title", content: "Dashboard — MarkahKu" },
      { property: "og:description", content: "Your average, CGPA, subject grades and trend at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const t = useT();
  const { lang } = usePrefs();
  const { data: book, isLoading } = useGradebook();
  const { data: profile } = useProfile();
  const [form, setForm] = useState<number | null>(null);
  const [exam, setExam] = useState<ExamType>("sumatif_1");
  const [metric, setMetric] = useState<"average" | "cgpa">("average");
  const [scope, setScope] = useState<"current" | "all">("current");

  useEffect(() => {
    if (form != null || !book) return;
    const latest = latestExamWithData(book);
    if (latest) {
      setForm(latest.form);
      setExam(latest.exam);
    } else setForm(profile?.current_form ?? 1);
  }, [book, profile, form]);

  if (isLoading || !book || form == null)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );

  const sum = examSummary(book, form, exam);
  const change = examChange(book, form, exam);
  const session = sessionFor(book, form, exam);
  const top = session?.rank_position && session.rank_total ? rankTopPercent(session.rank_position, session.rank_total) : null;
  const empty = !hasAnyMarks(book);

  return (
    <>
      <PageHeader
        title={t("dash.title")}
        actions={
          <>
            <FormSelect value={form} onChange={setForm} />
            <ExamSelect value={exam} onChange={setExam} />
            {!empty && (
              <Button variant="outline" size="icon" aria-label={t("common.exportPdf")} onClick={() => exportExamPdf(book, form, exam, lang)}>
                <Download />
              </Button>
            )}
          </>
        }
      />

      {empty && (
        <Card className="mb-6 overflow-hidden">
          <CardContent className="relative flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="bg-gradient-primary absolute -left-10 -top-16 size-48 rounded-full opacity-20 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="bg-gradient-primary flex size-12 shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
                <Rocket className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{t("dash.getStarted")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("dash.getStartedSub")}</p>
              </div>
            </div>
            <div className="relative flex flex-wrap gap-2">
              <Button asChild variant="hero">
                <Link to="/exams">
                  <ClipboardList /> {t("dash.enterMarks")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/import">
                  <Upload /> {t("dash.importResults")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-2 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={t("common.total")} value={sum.counted ? sum.total : "—"} />
        <Stat label={t("common.average")} value={formatAverage(sum.average)} />
        <Stat label={t("common.cgpa")} value={formatCgpa(sum.cgpa)} />
        <Stat label={t("common.counted")} value={sum.counted} />
        <Stat
          label={t("common.rank")}
          value={session?.rank_position ? `${session.rank_position}/${session.rank_total ?? "?"}` : "—"}
          hint={top != null ? t("rank.percentile", { p: top }) : t("dash.noRank")}
        />
        <Stat
          label={t("common.change")}
          value={formatDelta(change.average)}
          hint={change.cgpa != null ? `${t("common.cgpa")} ${formatDelta(change.cgpa, 2)}` : t("dash.vsPrev")}
          tone={deltaTone(change.average)}
        />
      </div>

      <p className="mb-6 text-sm text-muted-foreground">{t("dash.countedOf", { c: sum.counted, p: sum.pending })}</p>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t("dash.gradeTable")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/exams">{t("common.edit")}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <GradeTable book={book} form={form} highlight={exam} />
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader className="gap-3">
              <CardTitle>{t("dash.trend")}</CardTitle>
              <div className="grid w-full gap-2">
                <Tabs value={metric} onValueChange={(v) => setMetric(v as "average" | "cgpa")}>
                  <TabsList aria-label={t("dash.trendMetric")} className="h-11 w-full">
                    <TabsTrigger value="average" className="h-full min-w-0 flex-1 whitespace-normal px-2 text-xs leading-tight">{t("common.average")}</TabsTrigger>
                    <TabsTrigger value="cgpa" className="h-full min-w-0 flex-1 whitespace-normal px-2 text-xs leading-tight">{t("common.cgpa")}</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Tabs value={scope} onValueChange={(v) => setScope(v as "current" | "all")}>
                  <TabsList aria-label={t("dash.trendScope")} className="h-11 w-full">
                    <TabsTrigger value="current" className="h-full min-w-0 flex-1 whitespace-normal px-2 text-xs leading-tight">{t("dash.trendCurrent")}</TabsTrigger>
                    <TabsTrigger value="all" className="h-full min-w-0 flex-1 whitespace-normal px-2 text-xs leading-tight">{t("dash.trendAll")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <TrendChart book={book} metric={metric} form={scope === "current" ? form : null} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("dash.goals")}</CardTitle>
            </CardHeader>
            <CardContent>
              <GoalBars book={book} form={form} compact />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
