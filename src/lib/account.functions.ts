import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Deletes the signed-in student's files, rows and auth account. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const bucket = supabase.storage.from("mark-sources");
    // Every original lives under "<userId>/<examId>/<file>"; also include any path recorded in
    // source_files so nothing is left behind if the folder layout ever changes.
    const paths = new Set<string>();
    const recorded = await supabase.from("source_files").select("storage_path").eq("user_id", userId);
    if (recorded.error) throw new Error("Could not list files");
    for (const r of recorded.data ?? []) if (r.storage_path.startsWith(`${userId}/`)) paths.add(r.storage_path);
    const top = await bucket.list(userId, { limit: 1000 });
    if (top.error) throw new Error("Could not list files");
    for (const entry of top.data ?? []) {
      if (entry.id) {
        paths.add(`${userId}/${entry.name}`);
        continue;
      }
      const inner = await bucket.list(`${userId}/${entry.name}`, { limit: 1000 });
      if (inner.error) throw new Error("Could not list files");
      for (const f of inner.data ?? []) paths.add(`${userId}/${entry.name}/${f.name}`);
    }
    const all = [...paths];
    for (let i = 0; i < all.length; i += 100) {
      const { error } = await bucket.remove(all.slice(i, i + 100));
      if (error) throw new Error("Could not delete files");
    }

    for (const table of ["marks", "source_files", "goals", "ai_insights", "exam_sessions", "user_subjects"] as const) {
      const { error } = await supabase.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`Could not delete ${table}`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usage = await supabaseAdmin.from("ai_usage").delete().eq("user_id", userId);
    if (usage.error) throw new Error("Could not delete usage");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error("Could not delete account");
    return { ok: true };
  });
