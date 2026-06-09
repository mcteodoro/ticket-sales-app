"use client";

import { AlertTriangle, CheckCircle2, Clock, DollarSign, Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { SaleStatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { SaleWithRelations } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardClient() {
  const [sales, setSales] = useState<SaleWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    await supabase.rpc("refresh_sale_statuses");

    const { data, error: salesError } = await supabase
      .from("sales")
      .select("*, customers(*), payments(*)")
      .order("created_at", { ascending: false });

    if (salesError) {
      setError(salesError.message);
      setLoading(false);
      return;
    }

    setSales((data ?? []) as unknown as SaleWithRelations[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const metrics = useMemo(() => {
    const totalSalesValue = sales.reduce((sum, sale) => sum + Number(sale.total_price), 0);
    const totalReceived = sales.reduce((sum, sale) => {
      return (
        sum +
        sale.payments
          .filter((payment) => payment.status === "paid")
          .reduce((inner, payment) => inner + Number(payment.amount), 0)
      );
    }, 0);

    const pendingSales = sales.filter((sale) => sale.status === "PENDING").length;
    const completedSales = sales.filter((sale) => sale.status === "RELEASED").length;
    const overdue = sales.flatMap((sale) =>
      sale.payments
        .filter((payment) => payment.status === "pending" && payment.payment_date < todayISO())
        .map((payment) => ({ sale, payment })),
    );

    return { totalSalesValue, totalReceived, pendingSales, completedSales, overdue };
  }, [sales]);

  const cards = [
    {
      label: "Total sales value",
      value: formatCurrency(metrics.totalSalesValue),
      icon: DollarSign,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Total received",
      value: formatCurrency(metrics.totalReceived),
      icon: CheckCircle2,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Pending sales",
      value: metrics.pendingSales.toString(),
      icon: Clock,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Completed sales",
      value: metrics.completedSales.toString(),
      icon: Ticket,
      tone: "bg-violet-50 text-violet-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Overview</p>
          <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
        </div>
        <Link
          href="/sales/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New sale
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <section key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <span className={`rounded-md p-2 ${card.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-slate-950">{loading ? "-" : card.value}</p>
            </section>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Recent sales</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Batch</th>
                  <th className="px-5 py-3 font-semibold">Value</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.slice(0, 6).map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link href={`/sales/${sale.id}`} className="font-medium text-slate-950 hover:text-emerald-700">
                        {sale.customers?.name ?? "Unknown customer"}
                      </Link>
                      <p className="text-xs text-slate-500">{sale.sector}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{sale.batch}</td>
                    <td className="px-5 py-4 font-medium text-slate-950">
                      {formatCurrency(Number(sale.total_price))}
                    </td>
                    <td className="px-5 py-4">
                      <SaleStatusBadge status={sale.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(sale.created_at.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && sales.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Ticket} title="No sales yet" body="Create the first ticket sale to populate metrics." />
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-950">Overdue customers</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {metrics.overdue.slice(0, 8).map(({ sale, payment }) => (
              <Link
                key={payment.id}
                href={`/sales/${sale.id}`}
                className="block px-5 py-4 transition hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{sale.customers?.name ?? "Unknown customer"}</p>
                    <p className="text-xs text-slate-500">
                      Installment {payment.installment_number} due {formatDate(payment.payment_date)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-950">{formatCurrency(Number(payment.amount))}</p>
                </div>
              </Link>
            ))}
          </div>
          {!loading && metrics.overdue.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No overdue pending installments.</div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
