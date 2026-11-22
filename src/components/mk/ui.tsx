import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EXAM_TYPES, FORMS, letterGrade, type ExamType, type Letter } from "@/lib/grading";
import { usePrefs, useT } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const gradeClass: Record<Letter, string> = {
  A: "bg-grade-a text-grade-ink",
  B: "bg-grade-b text-grade-ink",
  C: "bg-grade-c text-grade-ink",
  D: "bg-grade-d text-grade-ink",
  E: "bg-grade-e text-grade-ink",
  F: "bg-grade-f text-grade-ink",
};

export function GradeBadge({ mark, letter, className }: { mark?: number | null; letter?: Letter; className?: string }) {
  const l = letter ?? (mark != null ? letterGrade(mark) : null);
  if (!l) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-xs font-semibold",
        gradeClass[l],
        className,
      )}
    >
      {l}
    </span>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function FormSelect({ value, onChange, className }: { value: number; onChange: (f: number) => void; className?: string }) {
  const t = useT();
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={cn("w-36", className)} aria-label={t("common.form")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FORMS.map((f) => (
          <SelectItem key={f} value={String(f)}>
            {t("common.formN", { n: f })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ExamSelect({ value, onChange, className }: { value: ExamType; onChange: (e: ExamType) => void; className?: string }) {
  const t = useT();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ExamType)}>
      <SelectTrigger className={cn("w-40", className)} aria-label={t("common.exam")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EXAM_TYPES.map((e) => (
          <SelectItem key={e} value={e}>
            {t(`exam.${e}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "up" | "down" | "flat" }) {
  return (
    <div className="glass group relative overflow-hidden rounded-[1.4rem] p-4 transition-transform duration-300 hover:-translate-y-0.5 md:p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-semibold tabular">{value}</div>
      {hint && (
        <div
          className={cn(
            "mt-1 text-xs tabular",
            tone === "up" && "text-success",
            tone === "down" && "text-destructive",
            (!tone || tone === "flat") && "text-muted-foreground",
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="text-primary [&_svg]:size-8">{icon}</div>}
      <div className="font-display text-lg font-semibold">{title}</div>
      {sub && <p className="max-w-md text-sm text-muted-foreground">{sub}</p>}
      {action}
    </div>
  );
}

export function LangToggle({ onChange }: { onChange?: (l: "ms" | "en") => void }) {
  const { lang, setLang } = usePrefs();
  const t = useT();
  return (
    <div className="glass inline-flex min-h-12 rounded-full p-1 text-xs font-semibold" role="group" aria-label={t("common.language")}>
      {(["ms", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            setLang(l);
            onChange?.(l);
          }}
          className={cn(
            "min-h-10 min-w-12 rounded-full px-3 py-1 transition-all",
            lang === l ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={lang === l}
        >
          {l === "ms" ? "BM" : "EN"}
        </button>
      ))}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-gradient-primary flex size-8 items-center justify-center rounded-xl font-display text-sm font-bold text-primary-foreground shadow-glow">
        M
      </div>
      <span className="font-display text-lg font-semibold tracking-tight">
        Markah<span className="text-gradient">Ku</span>
      </span>
    </div>
  );
}

export function deltaTone(n: number | null | undefined): "up" | "down" | "flat" {
  if (n == null || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}
