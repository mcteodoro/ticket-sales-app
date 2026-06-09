import type { PaymentStatus, SaleStatus } from "@/lib/types";

const saleStyles: Record<SaleStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  RELEASED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  EXPIRED: "border-rose-200 bg-rose-50 text-rose-800",
};

const paymentStyles: Record<PaymentStatus, string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${saleStyles[status]}`}
    >
      {status}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold capitalize ${paymentStyles[status]}`}
    >
      {status}
    </span>
  );
}
