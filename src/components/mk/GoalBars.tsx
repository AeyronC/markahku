import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { usePrefs, useT } from "@/lib/i18n";
import {
  examGoalProgress,
  formatAverage,
  formatCgpa,
  subjectGoalProgress,
  type GoalLetter,
} from "@/lib/grading";
import { subjectName, type Gradebook } from "@/lib/gradebook";
import { examSummary, latestCountedMark } from "@/lib/book-derived";
import { GradeBadge } from "./ui";

export function GoalBars({ book, form, compact }: { book: Gradebook; form: number; compact?: boolean }) {
  const t = useT();
  const { lang } = usePrefs();
  const goals = book.goals.filter((g) => g.form === form);
  if (!goals.length)
    return (
      <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
        {t("dash.noGoals")}
        <Button asChild variant="outline" size="sm">
          <Link to="/goals">{t("dash.setGoals")}</Link>
        </Button>
      </div>
    );

  const examGoals = goals.filter((g) => g.scope === "exam");
  const subjGoals = goals.filter((g) => g.scope === "subject");
  return (
    <div className="space-y-4">
      {examGoals.flatMap((g) => {
        const sum = examSummary(book, form, g.exam!);
        const out = [];
        if (g.target_average != null) {
          const p = examGoalProgress(sum.average, Number(g.target_average));
          out.push(
            <Bar
              key={g.id + "a"}
              label={`${t(`exam.${g.exam!}`)} · ${t("common.average")}`}
              value={`${formatAverage(sum.average)} / ${formatAverage(Number(g.target_average))}`}
              progress={p.progress}
              note={p.met ? t("goals.met") : p.gap != null ? t("goals.toGo", { n: p.gap.toFixed(1) }) : t("goals.noMark")}
              met={p.met}
            />,
          );
        }
        if (g.target_cgpa != null) {
          const p = examGoalProgress(sum.cgpa, Number(g.target_cgpa));
          out.push(
            <Bar
              key={g.id + "c"}
              label={`${t(`exam.${g.exam!}`)} · ${t("common.cgpa")}`}
              value={`${formatCgpa(sum.cgpa)} / ${formatCgpa(Number(g.target_cgpa))}`}
              progress={p.progress}
              note={p.met ? t("goals.met") : p.gap != null ? t("goals.toGoCgpa", { n: p.gap.toFixed(2) }) : t("goals.noMark")}
              met={p.met}
            />,
          );
        }
        return out;
      })}
      {(compact ? subjGoals.slice(0, 6) : subjGoals).map((g) => {
        const subj = book.subjects.find((s) => s.id === g.user_subject_id);
        const latest = latestCountedMark(book, form, g.user_subject_id!);
        const p = subjectGoalProgress(latest, g.target_grade as GoalLetter);
        const name = subjectName(subj, lang);
        const gapNote = p.gap != null
          ? t("goals.gap", { n: Math.ceil(p.gap), grade: g.target_grade ?? "", subject: name })
          : t("goals.noMark");
        return (
          <Bar
            key={g.id}
            label={name}
            value={
              <span className="flex items-center gap-1.5">
                <GradeBadge mark={latest} /> → <GradeBadge letter={g.target_grade as GoalLetter} />
              </span>
            }
            progress={p.progress}
            note={p.met ? t("goals.met") : gapNote}
            met={p.met}
          />
        );
      })}
    </div>
  );
}

function Bar({ label, value, progress, note, met }: { label: string; value: ReactNode; progress: number; note: string; met: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">{value}</span>
      </div>
      <Progress value={progress * 100} className="h-2" />
      <div className={met ? "mt-1 flex items-center gap-1 text-xs text-success" : "mt-1 text-xs text-muted-foreground"}>{met && <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" />}<span>{note}</span></div>
    </div>
  );
}
