import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePrefs, useT } from "@/lib/i18n";
import { EXAM_TYPES, cgpaPoints, effectiveMark, letterGrade, type ExamType } from "@/lib/grading";
import { markFor, sessionFor, subjectName, subjectsForForm, type Gradebook } from "@/lib/gradebook";
import { cn } from "@/lib/utils";
import { GradeBadge } from "./ui";

/** Report-sheet style table: Subject, then Marks + Grade for S1, S2 and UASA. */
export function GradeTable({ book, form, highlight }: { book: Gradebook; form: number; highlight?: ExamType }) {
  const t = useT();
  const { lang } = usePrefs();
  const subjects = subjectsForForm(book, form, true).filter(
    (s) => s.is_active || EXAM_TYPES.some((e) => markFor(book, sessionFor(book, form, e)?.id, s.id)),
  );
  const sessions = EXAM_TYPES.map((e) => sessionFor(book, form, e));

  if (!subjects.length) return <p className="text-sm text-muted-foreground">{t("exams.noSubjects")}</p>;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted-foreground">
              <th className="sticky left-0 z-20 bg-background px-2 pb-2 text-left font-medium">{t("common.subject")}</th>
              {EXAM_TYPES.map((e) => (
                <th key={e} colSpan={2} className={cn("px-2 pb-2 text-center font-medium", highlight === e && "text-primary")}>
                  {t(`exam.${e}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="sticky left-0 z-10 bg-background px-2 py-2.5 font-medium">{subjectName(s, lang)}</td>
                {sessions.map((sess, i) => {
                  const entry = markFor(book, sess?.id, s.id);
                  const mark = entry ? effectiveMark(entry) : null;
                  const highlightExam = highlight === EXAM_TYPES[i];
                  return <FragmentCells key={i} highlight={highlightExam} mark={mark} status={entry?.status ?? null} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}

function FragmentCells({ mark, highlight, status }: { mark: number | null; highlight: boolean; status: string | null }) {
  const t = useT();
  const { lang } = usePrefs();
  const reason = t("grade.explain");

  return (
    <>
      <td className={cn("px-2 py-2.5 text-right font-mono tabular", highlight && "bg-accent/50")} title={status ? t(`status.${status}`) : undefined}>
        {mark ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className={cn("px-2 py-2.5", highlight && "bg-accent/50")}>
        <div className="flex min-h-8 items-center gap-1.5">
          <GradeBadge mark={mark} />
          {status === "pending" && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-4 text-muted-foreground">
              {t("status.pending")}
            </span>
          )}
          {mark != null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={reason} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <CircleHelp className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <span>{reason}: {t("grade.letter")} {letterGrade(mark)} · {t("grade.points")} {cgpaPoints(mark).toFixed(2)}</span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>
    </>
  );
}
