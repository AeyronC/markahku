import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormSelect, GradeBadge, PageHeader, Stat, deltaTone } from "@/components/mk/ui";
import { usePrefs, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  EXAM_TYPES,
  effectiveMark,
  formatAverage,
  formatCgpa,
  formatDelta,
  round2,
  yearlySubjectMean,
  yearlySummary,
} from "@/lib/grading";
import { markFor, sessionFor, subjectName, subjectsForForm, useGradebook, useProfile } from "@/lib/gradebook";
import { examSummary } from "@/lib/book-derived";
import { exportYearPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/yearly")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Tahunan · Yearly — MarkahKu" },
      { name: "description", content: "Sumatif 1, Sumatif 2 and UASA of one Form combined: subject means, yearly average and CGPA." },
      { property: "og:title", content: "Yearly view — MarkahKu" },
      { property: "og:description", content: "All three exams of one Form combined." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Yearly,
});

const d = (a: number | null, b: number | null) => (a != null && b != null ? round2(b - a) : null);

function Yearly() {
  const t = useT();
  const { lang } = usePrefs();
  const { data: book } = useGradebook();
  const { data: profile } = useProfile();
  const [form, setForm] = useState(1);
  useEffect(() => {
    if (profile?.current_form) setForm(profile.current_form);
  }, [profile?.current_form]);

  if (!book) return <Skeleton className="h-96 rounded-2xl" />;

  const per = EXAM_TYPES.map((e) => examSummary(book, form, e));
  const y = yearlySummary(per);
  const subjects = subjectsForForm(book, form, true);

  return (
    <>
      <PageHeader
        title={t("yr.title")}
        sub={t("yr.sub")}
        actions={
          <>
            <FormSelect value={form} onChange={setForm} />
            <Button variant="outline" onClick={() => exportYearPdf(book, form, lang)}>
              <Download /> {t("common.exportPdf")}
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("yr.yearAvg")} value={formatAverage(y.average)} />
        <Stat label={t("yr.yearCgpa")} value={formatCgpa(y.cgpa)} />
        <Stat label={t("yr.s1s2")} value={formatDelta(d(per[0]!.average, per[1]!.average))} hint={`${t("common.cgpa")} ${formatDelta(d(per[0]!.cgpa, per[1]!.cgpa), 2)}`} tone={deltaTone(d(per[0]!.average, per[1]!.average))} />
        <Stat label={t("yr.s2uasa")} value={formatDelta(d(per[1]!.average, per[2]!.average))} hint={`${t("common.cgpa")} ${formatDelta(d(per[1]!.cgpa, per[2]!.cgpa), 2)}`} tone={deltaTone(d(per[1]!.average, per[2]!.average))} />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-4 md:p-6">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-2 pb-3 text-left font-medium">{t("common.subject")}</th>
                {EXAM_TYPES.map((e) => (
                  <th key={e} className="px-2 pb-3 text-center font-medium">{t(`exam.${e}`)}</th>
                ))}
                <th className="px-2 pb-3 text-center font-medium">{t("yr.s1s2")}</th>
                <th className="px-2 pb-3 text-center font-medium">{t("yr.s2uasa")}</th>
                <th className="px-2 pb-3 text-right font-medium text-primary">{t("common.mean")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subjects.map((s) => {
                const entries = EXAM_TYPES.map((e) => markFor(book, sessionFor(book, form, e)?.id, s.id));
                const marks = entries.map((e) => (e ? effectiveMark(e) : null));
                const mean = yearlySubjectMean(entries);
                return (
                  <tr key={s.id}>
                    <td className="px-2 py-2.5 font-medium">{subjectName(s, lang)}</td>
                    {marks.map((m, i) => (
                      <td key={i} className="px-2 py-2.5">
                        <div className="flex items-center justify-center gap-2 font-mono tabular">
                          <span className="w-7 text-right">{m ?? "—"}</span>
                          <GradeBadge mark={m} />
                        </div>
                      </td>
                    ))}
                    {[d(marks[0]!, marks[1]!), d(marks[1]!, marks[2]!)].map((x, i) => (
                      <td key={i} className={cn("px-2 py-2.5 text-center font-mono text-xs tabular", x != null && x > 0 && "text-success", x != null && x < 0 && "text-destructive", x == null && "text-muted-foreground")}>
                        {x == null ? "—" : formatDelta(x, 0)}
                      </td>
                    ))}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-2 font-mono font-semibold tabular">
                        {formatAverage(mean)}
                        <GradeBadge mark={mean} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="px-2 pt-3">{t("common.average")}</td>
                {per.map((p, i) => (
                  <td key={i} className="px-2 pt-3 text-center font-mono tabular">{formatAverage(p.average)}</td>
                ))}
                <td colSpan={2} />
                <td className="px-2 pt-3 text-right font-mono tabular text-primary">{formatAverage(y.average)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="px-2 pt-2">{t("common.cgpa")}</td>
                {per.map((p, i) => (
                  <td key={i} className="px-2 pt-2 text-center font-mono tabular">{formatCgpa(p.cgpa)}</td>
                ))}
                <td colSpan={2} />
                <td className="px-2 pt-2 text-right font-mono tabular text-primary">{formatCgpa(y.cgpa)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
