import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Loader2, Moon, Plus, Shield, Sun, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FormSelect, LangToggle, PageHeader } from "@/components/mk/ui";
import { usePrefs, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  addCustomSubject,
  ensureFormSubjects,
  subjectName,
  subjectsForForm,
  updateProfile,
  useGradebook,
  useProfile,
} from "@/lib/gradebook";
import { downloadJson, exportMarks } from "@/lib/export";
import { deleteAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Tetapan · Settings — MarkahKu" },
      { name: "description", content: "Profile, language, theme, subjects, data download and account deletion." },
      { property: "og:title", content: "Settings — MarkahKu" },
      { property: "og:description", content: "Profile, language, theme, subjects and your data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const t = useT();
  const { lang, theme, setTheme } = usePrefs();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: book } = useGradebook();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [cls, setCls] = useState("");
  const [currentForm, setCurrentForm] = useState(1);
  const [subjForm, setSubjForm] = useState(1);
  const [newSubj, setNewSubj] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const del = useServerFn(deleteAccount);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setSchool(profile.school ?? "");
    setCls(profile.class_name ?? "");
    setCurrentForm(profile.current_form ?? 1);
    setSubjForm(profile.current_form ?? 1);
  }, [profile]);

  const refreshAll = () => qc.invalidateQueries();

  async function saveProfile() {
    try {
      await updateProfile({
        display_name: name.trim().slice(0, 80) || null,
        school: school.trim().slice(0, 120) || null,
        class_name: cls.trim().slice(0, 40) || null,
        current_form: currentForm,
      });
      await refreshAll();
      toast.success(t("common.saved"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  async function toggleSubject(id: string, active: boolean) {
    const { error } = await supabase.from("user_subjects").update({ is_active: active }).eq("id", id);
    if (error) toast.error(t("common.error"));
    await qc.invalidateQueries({ queryKey: ["gradebook"] });
  }

  async function addSubject() {
    const v = newSubj.trim();
    if (!v) return;
    try {
      await addCustomSubject(subjForm, v);
      setNewSubj("");
      await qc.invalidateQueries({ queryKey: ["gradebook"] });
    } catch {
      toast.error(t("common.error"));
    }
  }

  async function removeSubject(id: string) {
    const { error } = await supabase.from("user_subjects").delete().eq("id", id);
    if (error) toast.error(t("common.error"));
    await qc.invalidateQueries({ queryKey: ["gradebook"] });
  }

  async function downloadAll() {
    const [p, s, e, m, g, f, i] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_subjects").select("*, subject_catalog(name_ms, name_en)"),
      supabase.from("exam_sessions").select("*"),
      supabase.from("marks").select("*"),
      supabase.from("goals").select("*"),
      supabase.from("source_files").select("*"),
      supabase.from("ai_insights").select("*"),
    ]);
    downloadJson(
      { exported_at: new Date().toISOString(), profile: p.data, subjects: s.data, exam_sessions: e.data, marks: m.data, goals: g.data, source_files: f.data, ai_insights: i.data },
      "markahku-my-data.json",
    );
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await del();
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      toast.success(t("set.deleted"));
      navigate({ to: "/", replace: true });
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
      setDeleting(false);
    }
  }

  const formSubjects = book ? subjectsForForm(book, subjForm, true) : [];
  const hasMarks = (id: string) => !!book?.marks.some((m) => m.user_subject_id === id);

  return (
    <>
      <PageHeader title={t("set.title")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("set.profile")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nm">{t("set.name")}</Label>
              <Input id="nm" className="mt-1.5" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="sc">{t("onb.school")}</Label>
                <Input id="sc" className="mt-1.5" value={school} maxLength={120} onChange={(e) => setSchool(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cl">{t("onb.class")}</Label>
                <Input id="cl" className="mt-1.5" value={cls} maxLength={40} onChange={(e) => setCls(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t("onb.currentForm")}</Label>
              <FormSelect className="mt-1.5" value={currentForm} onChange={setCurrentForm} />
            </div>
            <Button variant="hero" onClick={saveProfile}>
              {t("common.save")}
            </Button>
            <div className="flex flex-wrap items-center gap-6 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label>{t("common.language")}</Label>
                <div>
                  <LangToggle onChange={(l) => updateProfile({ language: l }).then(refreshAll)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.theme")}</Label>
                <div className="glass inline-flex rounded-lg p-0.5">
                  {(["dark", "light"] as const).map((th) => (
                    <button
                      key={th}
                      onClick={() => {
                        setTheme(th);
                        void updateProfile({ theme: th });
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
                        theme === th ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {th === "dark" ? <Moon className="size-3" /> : <Sun className="size-3" />}
                      {t(th === "dark" ? "common.dark" : "common.light")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>{t("set.subjects")}</CardTitle>
              <CardDescription className="mt-1.5">{t("set.subjectsHint")}</CardDescription>
            </div>
            <FormSelect value={subjForm} onChange={setSubjForm} />
          </CardHeader>
          <CardContent>
            {formSubjects.length === 0 ? (
              <Button variant="outline" onClick={() => ensureFormSubjects(subjForm).then(() => qc.invalidateQueries({ queryKey: ["gradebook"] }))}>
                {t("exams.setupSubjects", { n: subjForm })}
              </Button>
            ) : (
              <div className="divide-y divide-border">
                {formSubjects.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <span className={cn("text-sm", !s.is_active && "text-muted-foreground line-through")}>{subjectName(s, lang)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{s.is_active ? t("set.active") : t("set.hidden")}</span>
                      <Switch checked={s.is_active} onCheckedChange={(v) => toggleSubject(s.id, v)} aria-label={subjectName(s, lang)} />
                      {s.custom_name && !hasMarks(s.id) && (
                        <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => removeSubject(s.id)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void addSubject();
              }}
            >
              <Input placeholder={t("onb.customPlaceholder")} value={newSubj} maxLength={80} onChange={(e) => setNewSubj(e.target.value)} />
              <Button type="submit" variant="outline">
                <Plus /> {t("common.add")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("set.data")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => book && exportMarks(book, lang, "xlsx")}>
              <FileSpreadsheet /> {t("common.exportXlsx")}
            </Button>
            <Button variant="outline" onClick={() => book && exportMarks(book, lang, "csv")}>
              <FileSpreadsheet /> {t("common.exportCsv")}
            </Button>
            <Button variant="outline" onClick={downloadAll}>
              <Download /> {t("set.download")}
            </Button>
            <Button asChild variant="ghost">
              <Link to="/privacy">
                <Shield /> {t("nav.privacy")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{t("set.deleteTitle")}</CardTitle>
            <CardDescription>{t("set.deleteBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog onOpenChange={() => setConfirm("")}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 /> {t("set.deleteTitle")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-strong">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("set.deleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("set.deleteBody")}</AlertDialogDescription>
                </AlertDialogHeader>
                <div>
                  <Label htmlFor="cf">{t("set.deleteConfirm")}</Label>
                  <Input id="cf" className="mt-1.5 font-mono" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirm !== "DELETE" || deleting}
                    onClick={(e) => {
                      e.preventDefault();
                      void doDelete();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting && <Loader2 className="animate-spin" />}
                    {t("common.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
