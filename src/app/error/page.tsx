import Link from "next/link";

export default function ErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-rose-700">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Authentication could not be completed.
        </h1>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Back to login
        </Link>
      </section>
    </main>
  );
}
