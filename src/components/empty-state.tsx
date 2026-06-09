import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}
