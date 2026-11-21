import { usePrefs, useT } from "@/lib/i18n";
import { EXAM_TYPES, effectiveMark, type ExamType } from "@/lib/grading";
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
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-2 pb-2 text-left font-medium">{t("common.subject")}</th>
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
              <td className="px-2 py-2.5 font-medium">{subjectName(s, lang)}</td>
              {sessions.map((sess, i) => {
                const e = markFor(book, sess?.id, s.id);
                const m = e ? effectiveMark(e) : null;
                const hl = highlight === EXAM_TYPES[i];
                return (
                  <FragmentCells key={i} highlight={hl} mark={m} label={e && m == null ? t(`status.${e.status}`) : null} />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentCells({ mark, highlight, label }: { mark: number | null; highlight: boolean; label: string | null }) {
  return (
    <>
      <td className={cn("px-2 py-2.5 text-right font-mono tabular", highlight && "bg-accent/50")} title={label ?? undefined}>
        {mark ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className={cn("px-2 py-2.5", highlight && "bg-accent/50")}>
        <GradeBadge mark={mark} />
      </td>
    </>
  );
}
