"use client";

import { Plus, Search, Ticket } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { SaleStatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { SaleStatus, SaleWithRelations } from "@/lib/types";

const statuses: Array<"ALL" | SaleStatus> = ["ALL", "PENDING", "RELEASED", "EXPIRED"];

export function SalesListClient() {
  const [sales, setSales] = useState<SaleWithRelations[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | SaleStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSales() {
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
      void loadSales();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const customer = sale.customers;
      const searchable = `${customer?.name ?? ""} ${customer?.email ?? ""} ${customer?.phone ?? ""} ${
        sale.sector
      } ${sale.batch}`.toLowerCase();

      return (
        searchable.includes(query.toLowerCase()) &&
        (status === "ALL" || sale.status === status)
      );
    });
  }, [query, sales, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Sales</p>
          <h1 className="text-2xl font-semibold text-slate-950">Sales list</h1>
        </div>
        <Link
          href="/sales/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New sale
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, email, phone, sector"
              className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {statuses.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`h-10 rounded-md border px-3 text-sm font-medium transition ${
                  status === item
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Sector</th>
                <th className="px-5 py-3 font-semibold">Batch</th>
                <th className="px-5 py-3 font-semibold">Payment</th>
                <th className="px-5 py-3 font-semibold">Value</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link href={`/sales/${sale.id}`} className="font-medium text-slate-950 hover:text-emerald-700">
                      {sale.customers?.name ?? "Unknown customer"}
                    </Link>
                    <p className="text-xs text-slate-500">{sale.customers?.email}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{sale.sector}</td>
                  <td className="px-5 py-4 text-slate-600">{sale.batch}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {sale.payment_type} / {sale.installments}
                  </td>
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

        {!loading && filteredSales.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Ticket} title="No matching sales" body="Adjust the filters or create a new sale." />
          </div>
        ) : null}
      </section>
    </div>
  );
}
