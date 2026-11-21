import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/gradebook";
import { AppShell } from "@/components/mk/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    const profile = await context.queryClient.ensureQueryData(profileQuery);
    const onOnboarding = location.pathname.startsWith("/onboarding");
    if (!profile?.onboarded_at && !onOnboarding) throw redirect({ to: "/onboarding" });
    return { user: data.user };
  },
  component: AppShell,
});
