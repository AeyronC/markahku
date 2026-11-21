import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Deletes the signed-in student's files, rows and auth account. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const bucket = supabase.storage.from("mark-sources");
    const top = await bucket.list(userId, { limit: 1000 });
    const paths: string[] = [];
    for (const entry of top.data ?? []) {
      if (entry.id) {
        paths.push(`${userId}/${entry.name}`);
        continue;
      }
      const inner = await bucket.list(`${userId}/${entry.name}`, { limit: 1000 });
      for (const f of inner.data ?? []) paths.push(`${userId}/${entry.name}/${f.name}`);
    }
    for (let i = 0; i < paths.length; i += 100) await bucket.remove(paths.slice(i, i + 100));

    for (const table of ["marks", "source_files", "goals", "ai_insights", "exam_sessions", "user_subjects"] as const) {
      const { error } = await supabase.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`Could not delete ${table}`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage").delete().eq("user_id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error("Could not delete account");
    return { ok: true };
  });
