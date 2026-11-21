import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Moon, Plus, Sun, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/mk/ui";
import { usePrefs, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { FORMS } from "@/lib/grading";
import { currentUserId, updateProfile, useCatalog, useProfile } from "@/lib/gradebook";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Mula · Get started — MarkahKu" },
      { name: "description", content: "Set up your language, Form and subjects." },
      { property: "og:title", content: "Get started — MarkahKu" },
      { property: "og:description", content: "Set up your language, Form and subjects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const t = useT();
  const { lang, theme, setLang, setTheme } = usePrefs();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: catalog } = useCatalog();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(1);
  const [school, setSchool] = useState("");
  const [cls, setCls] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [custom, setCustom] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile?.current_form) setForm(profile.current_form);
    if (profile?.school) setSchool(profile.school);
    if (profile?.class_name) setCls(profile.class_name);
  }, [profile]);

  const formCatalog = useMemo(() => (catalog ?? []).filter((c) => c.forms.includes(form)), [catalog, form]);
  useEffect(() => {
    setPicked(new Set(formCatalog.filter((c) => c.is_core).map((c) => c.id)));
  }, [formCatalog]);

  async function saveSubjects() {
    setBusy(true);
    try {
      const user_id = await currentUserId();
      const existing = await supabase.from("user_subjects").select("id").eq("form", form).limit(1);
      if (!existing.data?.length) {
        const ids = formCatalog.filter((c) => picked.has(c.id)).map((c) => c.id);
        const rows = [
          ...ids.map((catalog_id, i) => ({ user_id, form, catalog_id, sort_order: i })),
          ...custom.map((custom_name, i) => ({ user_id, form, custom_name, sort_order: ids.length + i })),
        ];
        if (rows.length) {
          const { error } = await supabase.from("user_subjects").insert(rows);
          if (error) throw error;
        }
      }
      await updateProfile({
        language: lang,
        theme,
        current_form: form,
        school: school.trim() || null,
        class_name: cls.trim() || null,
        onboarded_at: new Date().toISOString(),
      });
      await qc.invalidateQueries();
      setStep(4);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const steps = [t("onb.s1"), t("onb.s2"), t("onb.s3"), t("onb.s4")];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-8">
      <Logo />
      <div className="mt-10">
        <div className="text-xs font-medium uppercase tracking-wider text-primary">{t("onb.step", { n: step })}</div>
        <h1 className="mt-1 text-3xl font-semibold">{t("onb.title")}</h1>
        <div className="mt-5 flex gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={cn("h-1.5 rounded-full", i < step ? "bg-gradient-primary" : "bg-muted")} />
              <div className={cn("mt-1.5 hidden text-xs sm:block", i + 1 === step ? "text-foreground" : "text-muted-foreground")}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass mt-8 animate-rise rounded-3xl p-6 md:p-8" key={step}>
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">{t("common.language")}</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["ms", "en"] as const).map((l) => (
                  <ChoiceCard key={l} active={lang === l} onClick={() => setLang(l)}>
                    {l === "ms" ? "Bahasa Melayu" : "English"}
                  </ChoiceCard>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">{t("common.theme")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceCard active={theme === "dark"} onClick={() => setTheme("dark")}>
                  <Moon className="size-4" /> {t("common.dark")}
                </ChoiceCard>
                <ChoiceCard active={theme === "light"} onClick={() => setTheme("light")}>
                  <Sun className="size-4" /> {t("common.light")}
                </ChoiceCard>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="hero" onClick={() => setStep(2)}>
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">{t("onb.currentForm")}</Label>
              <div className="grid grid-cols-5 gap-2">
                {FORMS.map((f) => (
                  <ChoiceCard key={f} active={form === f} onClick={() => setForm(f)}>
                    <span className="font-display text-xl">{f}</span>
                  </ChoiceCard>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="school">
                  {t("onb.school")} <span className="text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <Input id="school" className="mt-1.5" maxLength={120} value={school} onChange={(e) => setSchool(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cls">
                  {t("onb.class")} <span className="text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <Input id="cls" className="mt-1.5" maxLength={40} value={cls} onChange={(e) => setCls(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                {t("common.back")}
              </Button>
              <Button variant="hero" onClick={() => setStep(3)}>
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{t("onb.subjectsHint")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {formCatalog.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-accent">
                  <Checkbox
                    checked={picked.has(c.id)}
                    onCheckedChange={(v) => {
                      const n = new Set(picked);
                      if (v) n.add(c.id);
                      else n.delete(c.id);
                      setPicked(n);
                    }}
                  />
                  {lang === "ms" ? c.name_ms : c.name_en}
                </label>
              ))}
              {custom.map((c) => (
                <div key={c} className="flex items-center justify-between rounded-xl border border-primary/40 bg-accent px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-3">
                    <Check className="size-4 text-primary" /> {c}
                  </span>
                  <button aria-label={t("common.delete")} onClick={() => setCustom(custom.filter((x) => x !== c))}>
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = customDraft.trim().slice(0, 80);
                if (v && !custom.includes(v)) setCustom([...custom, v]);
                setCustomDraft("");
              }}
            >
              <Input placeholder={t("onb.customPlaceholder")} value={customDraft} maxLength={80} onChange={(e) => setCustomDraft(e.target.value)} />
              <Button type="submit" variant="outline">
                <Plus /> {t("common.add")}
              </Button>
            </form>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                {t("common.back")}
              </Button>
              <Button variant="hero" disabled={busy || picked.size + custom.length === 0} onClick={saveSubjects}>
                {busy ? t("common.saving") : t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 text-center">
            <div className="bg-gradient-primary mx-auto flex size-14 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
              <Upload className="size-6" />
            </div>
            <p className="mx-auto max-w-md text-muted-foreground">{t("onb.importHint")}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="hero" onClick={() => navigate({ to: "/import" })}>
                {t("onb.importNow")}
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
                {t("onb.skip")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceCard({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-sm font-medium transition-all",
        active ? "border-primary bg-accent text-accent-foreground shadow-glow" : "border-border hover:bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}
