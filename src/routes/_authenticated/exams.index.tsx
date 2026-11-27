import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/mk/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EXAM_TYPES, FORMS, formatAverage, formatCgpa, type ExamType } from "@/lib/grading";
import { ensureSession, sessionFor, useGradebook, useProfile } from "@/lib/gradebook";
import { examSummary } from "@/lib/book-derived";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/exams/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Peperiksaan · Exams — MarkahKu" },
      { name: "description", content: "All your Sumatif 1, Sumatif 2 and UASA exams across Forms 1–5." },
      { property: "og:title", content: "Exams — MarkahKu" },
      { property: "og:description", content: "All your Sumatif 1, Sumatif 2 and UASA exams across Forms 1–5." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamsPage,
});

function ExamsPage() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: book, isLoading } = useGradebook();
  const { data: profile } = useProfile();
  const [opening, setOpening] = useState<string | null>(null);
  const current = profile?.current_form ?? 1;

  async function open(form: number, exam: ExamType) {
    const key = `${form}-${exam}`;
    setOpening(key);
    try {
      const s = book ? sessionFor(book, form, exam) : undefined;
      const session = s ?? (await ensureSession(form, exam, new Date().getFullYear()));
      await qc.invalidateQueries({ queryKey: ["gradebook"] });
      navigate({ to: "/exams/$id", params: { id: session.id } });
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
      setOpening(null);
    }
  }

  const forms = [...FORMS].sort((a, b) => (a === current ? -1 : b === current ? 1 : a - b));

  return (
    <>
      <PageHeader title={t("exams.title")} sub={t("exams.sub")} />
      {isLoading || !book ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {forms.map((form) => (
            <section key={form}>
              <h2 className={cn("mb-3 text-lg font-semibold", form === current && "text-primary")}>{t("common.formN", { n: form })}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {EXAM_TYPES.map((exam) => {
                  const sum = examSummary(book, form, exam);
                  const has = sum.counted > 0;
                  return (
                    <button
                      key={exam}
                      onClick={() => open(form, exam)}
                      disabled={opening === `${form}-${exam}`}
                      className="glass group flex items-center justify-between rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow disabled:opacity-60"
                    >
                      <div>
                        <div className="font-display font-semibold">{t(`exam.${exam}`)}</div>
                        {has ? (
                          <div className="mt-1 flex gap-3 font-mono text-sm tabular text-muted-foreground">
                            <span>
                              {t("common.average")} <span className="text-foreground">{formatAverage(sum.average)}</span>
                            </span>
                            <span>
                              {t("common.cgpa")} <span className="text-foreground">{formatCgpa(sum.cgpa)}</span>
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-muted-foreground">{t("exams.noData")}</div>
                        )}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
