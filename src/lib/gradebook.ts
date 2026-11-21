import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ExamType, MarkEntry, MarkStatus } from "./grading";
import type { Lang } from "./i18n-dict";

type T = Database["public"]["Tables"];
export type Profile = T["profiles"]["Row"];
export type CatalogSubject = T["subject_catalog"]["Row"];
export type UserSubject = T["user_subjects"]["Row"] & {
  subject_catalog: { name_ms: string; name_en: string } | null;
};
export type Session = T["exam_sessions"]["Row"];
export type MarkRow = T["marks"]["Row"];
export type Goal = T["goals"]["Row"];
export type SourceFile = T["source_files"]["Row"];
export type Insight = T["ai_insights"]["Row"];

export interface Gradebook {
  subjects: UserSubject[];
  sessions: Session[];
  marks: MarkRow[];
  goals: Goal[];
}

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async (): Promise<Profile | null> => {
    const id = await currentUserId();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
});

export const gradebookQuery = queryOptions({
  queryKey: ["gradebook"],
  queryFn: async (): Promise<Gradebook> => {
    const [subjects, sessions, marks, goals] = await Promise.all([
      supabase
        .from("user_subjects")
        .select("*, subject_catalog(name_ms, name_en)")
        .order("form")
        .order("sort_order"),
      supabase.from("exam_sessions").select("*"),
      supabase.from("marks").select("*"),
      supabase.from("goals").select("*"),
    ]);
    for (const r of [subjects, sessions, marks, goals]) if (r.error) throw r.error;
    return {
      subjects: (subjects.data ?? []) as UserSubject[],
      sessions: sessions.data ?? [],
      marks: marks.data ?? [],
      goals: goals.data ?? [],
    };
  },
  staleTime: 30_000,
});

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: async () => {
    const { data, error } = await supabase.from("subject_catalog").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
  staleTime: Infinity,
});

export function useProfile() {
  return useQuery(profileQuery);
}
export function useGradebook() {
  return useQuery(gradebookQuery);
}
export function useCatalog() {
  return useQuery(catalogQuery);
}

export function useRefreshBook() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["gradebook"] });
}

export function subjectName(s: Pick<UserSubject, "custom_name" | "subject_catalog"> | undefined, lang: Lang) {
  if (!s) return "—";
  if (s.custom_name) return s.custom_name;
  return lang === "ms" ? (s.subject_catalog?.name_ms ?? "—") : (s.subject_catalog?.name_en ?? "—");
}

export async function updateProfile(patch: T["profiles"]["Update"]) {
  const id = await currentUserId();
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

export async function ensureSession(form: number, exam: ExamType, academicYear?: number | null): Promise<Session> {
  const user_id = await currentUserId();
  const existing = await supabase
    .from("exam_sessions")
    .select("*")
    .eq("form", form)
    .eq("exam", exam)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (academicYear && existing.data.academic_year !== academicYear) {
      const upd = await supabase
        .from("exam_sessions")
        .update({ academic_year: academicYear })
        .eq("id", existing.data.id)
        .select()
        .single();
      if (upd.error) throw upd.error;
      return upd.data;
    }
    return existing.data;
  }
  const { data, error } = await supabase
    .from("exam_sessions")
    .insert({ user_id, form, exam, academic_year: academicYear ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface MarkWrite {
  user_subject_id: string;
  status: MarkStatus;
  mark: number | null;
  source?: Database["public"]["Enums"]["mark_source"];
  source_file_id?: string | null;
}

export async function saveMarks(sessionId: string, rows: MarkWrite[]) {
  if (!rows.length) return;
  const user_id = await currentUserId();
  const { error } = await supabase.from("marks").upsert(
    rows.map((r) => ({
      user_id,
      session_id: sessionId,
      user_subject_id: r.user_subject_id,
      status: r.status,
      mark: r.status === "absent" ? 0 : r.status === "completed" ? r.mark : null,
      source: r.source ?? "manual",
      source_file_id: r.source_file_id ?? null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "session_id,user_subject_id" },
  );
  if (error) throw error;
}

/** Give a Form its preset subject list when it has none yet. */
export async function ensureFormSubjects(form: number, catalogIds?: number[], customNames: string[] = []) {
  const user_id = await currentUserId();
  const has = await supabase.from("user_subjects").select("id").eq("form", form).limit(1);
  if (has.error) throw has.error;
  if (has.data.length && !catalogIds) return;
  let ids = catalogIds;
  if (!ids) {
    const cat = await supabase.from("subject_catalog").select("*").order("sort_order");
    if (cat.error) throw cat.error;
    ids = cat.data.filter((c) => c.forms.includes(form) && c.is_core).map((c) => c.id);
  }
  const rows = [
    ...ids.map((catalog_id, i) => ({ user_id, form, catalog_id, sort_order: i })),
    ...customNames.map((custom_name, i) => ({ user_id, form, custom_name, sort_order: ids!.length + i })),
  ];
  if (!rows.length) return;
  const { error } = await supabase.from("user_subjects").insert(rows);
  if (error) throw error;
}

export async function addCustomSubject(form: number, name: string, sortOrder = 99) {
  const user_id = await currentUserId();
  const { data, error } = await supabase
    .from("user_subjects")
    .insert({ user_id, form, custom_name: name.trim().slice(0, 80), sort_order: sortOrder })
    .select("*, subject_catalog(name_ms, name_en)")
    .single();
  if (error) throw error;
  return data as UserSubject;
}

/* ---------- pure helpers over a loaded gradebook ---------- */

export function subjectsForForm(book: Gradebook, form: number, includeHidden = false) {
  return book.subjects.filter((s) => s.form === form && (includeHidden || s.is_active));
}

export function sessionFor(book: Gradebook, form: number, exam: ExamType) {
  return book.sessions.find((s) => s.form === form && s.exam === exam);
}

export function markFor(book: Gradebook, sessionId: string | undefined, subjectId: string): MarkEntry | undefined {
  if (!sessionId) return undefined;
  const m = book.marks.find((x) => x.session_id === sessionId && x.user_subject_id === subjectId);
  return m ? { status: m.status, mark: m.mark } : undefined;
}

export function entriesForSession(book: Gradebook, sessionId: string | undefined): MarkEntry[] {
  if (!sessionId) return [];
  return book.marks.filter((m) => m.session_id === sessionId).map((m) => ({ status: m.status, mark: m.mark }));
}

export function hasAnyMarks(book: Gradebook) {
  return book.marks.some((m) => m.status === "completed" || m.status === "absent");
}
