"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Receipt,
  RefreshCw,
  Save,
  Upload,
  UserRoundPen,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { PaymentStatusBadge, SaleStatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Payment, SaleWithRelations } from "@/lib/types";

type TransferState = Pick<Customer, "name" | "email" | "phone">;

export function SaleDetailClient({ saleId }: { saleId: string }) {
  const [sale, setSale] = useState<SaleWithRelations | null>(null);
  const [transfer, setTransfer] = useState<TransferState>({ name: "", email: "", phone: "" });
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [receiptLinks, setReceiptLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadSale = useCallback(async () => {
    setLoading(true);
    setError("");

    const supabase = createClient();
    await supabase.rpc("refresh_sale_statuses");

    const { data, error: saleError } = await supabase
      .from("sales")
      .select("*, customers(*), payments(*)")
      .eq("id", saleId)
      .single();

    if (saleError) {
      setError(saleError.message);
      setLoading(false);
      return;
    }

    const nextSale = data as unknown as SaleWithRelations;
    nextSale.payments = [...(nextSale.payments ?? [])].sort(
      (a, b) => a.installment_number - b.installment_number,
    );

    setSale(nextSale);
    setTransfer({
      name: nextSale.customers?.name ?? "",
      email: nextSale.customers?.email ?? "",
      phone: nextSale.customers?.phone ?? "",
    });

    const links: Record<string, string> = {};
    await Promise.all(
      nextSale.payments
        .filter((payment) => payment.receipt_url)
        .map(async (payment) => {
          const path = payment.receipt_url;
          if (!path) return;

          const { data: signed } = await supabase.storage
            .from("receipts")
            .createSignedUrl(path, 60 * 60);

          if (signed?.signedUrl) {
            links[payment.id] = signed.signedUrl;
          }
        }),
    );

    setReceiptLinks(links);
    setLoading(false);
  }, [saleId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSale();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSale]);

  const totals = useMemo(() => {
    const paid = sale?.payments
      .filter((payment) => payment.status === "paid")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    return {
      paid: paid ?? 0,
      pending: Math.max(Number(sale?.total_price ?? 0) - (paid ?? 0), 0),
    };
  }, [sale]);

  async function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sale?.customers) return;

    setSavingTransfer(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          name: transfer.name.trim(),
          email: transfer.email.trim(),
          phone: transfer.phone.trim(),
        })
        .eq("id", sale.customers.id);

      if (updateError) throw updateError;
      await loadSale();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not transfer ownership.");
    } finally {
      setSavingTransfer(false);
    }
  }

  async function registerPayment(payment: Payment) {
    const selectedFile = files[payment.id];

    if (!selectedFile) {
      setError("Upload a receipt before registering payment.");
      return;
    }

    setPayingId(payment.id);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in.");
      }

      const extension = selectedFile.name.split(".").pop() ?? "file";
      const receiptPath = `${user.id}/${saleId}/${payment.id}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(receiptPath, selectedFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("payments")
        .update({
          status: "paid",
          receipt_url: receiptPath,
        })
        .eq("id", payment.id);

      if (updateError) throw updateError;

      await supabase.rpc("recalculate_sale_status", { target_sale_id: saleId });
      setFiles((current) => ({ ...current, [payment.id]: undefined }));
      await loadSale();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not register payment.");
    } finally {
      setPayingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-44 rounded-md bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-36 rounded-lg bg-slate-200" />
          <div className="h-36 rounded-lg bg-slate-200" />
          <div className="h-36 rounded-lg bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error || "Sale not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link href="/sales" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sales
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-950">
              {sale.customers?.name ?? "Unknown customer"}
            </h1>
            <SaleStatusBadge status={sale.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {sale.sector} / {sale.batch} / Created {formatDateTime(sale.created_at)}
          </p>
        </div>

        <button
          type="button"
          onClick={loadSale}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total price</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {formatCurrency(Number(sale.total_price))}
          </p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Received</p>
          <p className="mt-3 text-2xl font-semibold text-emerald-700">{formatCurrency(totals.paid)}</p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending</p>
          <p className="mt-3 text-2xl font-semibold text-amber-700">{formatCurrency(totals.pending)}</p>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <Receipt className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-950">Payments</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Installment</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Payment date</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Receipt</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.payments.map((payment) => (
                  <tr key={payment.id} className="align-top">
                    <td className="px-5 py-4 font-medium text-slate-950">
                      {payment.installment_number}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{formatCurrency(Number(payment.amount))}</td>
                    <td className="px-5 py-4 text-slate-700">{formatDate(payment.payment_date)}</td>
                    <td className="px-5 py-4">
                      <PaymentStatusBadge status={payment.status} />
                    </td>
                    <td className="px-5 py-4">
                      {payment.status === "paid" && receiptLinks[payment.id] ? (
                        <a
                          href={receiptLinks[payment.id]}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          Open
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : payment.status === "paid" ? (
                        <span className="text-sm text-slate-500">Stored</span>
                      ) : (
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(event) =>
                            setFiles((current) => ({
                              ...current,
                              [payment.id]: event.target.files?.[0],
                            }))
                          }
                          className="w-56 text-sm text-slate-600 file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-medium file:text-slate-700"
                        />
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {payment.status === "paid" ? (
                        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Locked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => registerPayment(payment)}
                          disabled={payingId === payment.id || !files[payment.id]}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          <Upload className="h-4 w-4" aria-hidden="true" />
                          {payingId === payment.id ? "Saving..." : "Register"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UserRoundPen className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-950">Ownership transfer</h2>
          </div>

          <form onSubmit={handleTransfer} className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="transferName">
                Name
              </label>
              <input
                id="transferName"
                required
                value={transfer.name}
                onChange={(event) => setTransfer((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="transferEmail">
                Email
              </label>
              <input
                id="transferEmail"
                type="email"
                required
                value={transfer.email}
                onChange={(event) => setTransfer((current) => ({ ...current, email: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="transferPhone">
                Phone
              </label>
              <input
                id="transferPhone"
                required
                value={transfer.phone}
                onChange={(event) => setTransfer((current) => ({ ...current, phone: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <button
              type="submit"
              disabled={savingTransfer}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {savingTransfer ? "Saving..." : "Save transfer"}
            </button>
          </form>

          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Refunds and payment deletion are not available. Ownership changes keep the payment history intact.
          </div>
        </section>
      </div>
    </div>
  );
}
