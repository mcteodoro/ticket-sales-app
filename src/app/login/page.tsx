import { redirect } from "next/navigation";

import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import Image from "next/image";
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (data?.claims) {
      redirect("/dashboard");
    }
  }

  return (
    
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        
        <div className="mb-6">
  <Image
    src="/amae-promoter.jpg"
    alt="Amaê Festival"
    width={500}
    height={500}
    className="mx-auto rounded-lg"
    priority
  />
</div>
        <div>
          <p className="text-sm font-semibold text-emerald-700">Ticket Desk</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Sign in</h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage sales, installments, receipts, and ownership transfers.
          </p>
        </div>

        {hasSupabaseEnv() ? (
          <LoginForm />
        ) : (
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Add your Supabase URL and publishable key to `.env.local`.
          </div>
        )}
      </section>
    </main>
  );
}
