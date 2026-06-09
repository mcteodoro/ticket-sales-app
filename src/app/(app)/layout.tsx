import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function MissingConfig() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-xl rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Configuration needed</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Supabase environment variables are missing.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
          to `.env.local`, then restart the dev server.
        </p>
      </section>
    </main>
  );
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) {
    return <MissingConfig />;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const maybeEmail = data.claims.email;
  const userEmail = typeof maybeEmail === "string" ? maybeEmail : "Signed in";

  return <AppShell userEmail={userEmail}>{children}</AppShell>;
}
