"use client";

import { CalendarDays, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import {
  BATCHES,
  addMonthsToISODate,
  maxInstallmentsForDate,
  splitInstallmentAmounts,
  validateInstallmentSelection,
} from "@/lib/business-rules";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { PaymentType, TicketBatch } from "@/lib/types";

type FormState = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  sector: string;
  batch: TicketBatch;
  paymentType: PaymentType;
  totalPrice: string;
  installments: number;
  firstPaymentDate: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
  sector: "",
  batch: "Promo",
  paymentType: "Full",
  totalPrice: "",
  installments: 1,
  firstPaymentDate: new Date().toISOString().slice(0, 10),
};

export function CreateSaleForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const totalPrice = Number(form.totalPrice);
  const maxInstallments = maxInstallmentsForDate(form.firstPaymentDate);
  const validationMessage = validateInstallmentSelection(
    form.paymentType,
    form.installments,
    form.firstPaymentDate,
  );

  const previewAmounts = useMemo(() => {
    if (!Number.isFinite(totalPrice) || totalPrice <= 0 || validationMessage) {
      return [];
    }

    return splitInstallmentAmounts(totalPrice, form.installments);
  }, [form.installments, totalPrice, validationMessage]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateFirstPaymentDate(value: string) {
    const nextMax = maxInstallmentsForDate(value);

    setForm((current) => {
      if (nextMax === 1) {
        return { ...current, firstPaymentDate: value, paymentType: "Full", installments: 1 };
      }

      if (current.paymentType === "Full") {
        return { ...current, firstPaymentDate: value, installments: 1 };
      }

      return {
        ...current,
        firstPaymentDate: value,
        installments: Math.min(Math.max(current.installments, 2), nextMax),
      };
    });
  }

  function updatePaymentType(value: PaymentType) {
    setForm((current) => ({
      ...current,
      paymentType: value,
      installments:
        value === "Full"
          ? 1
          : Math.min(Math.max(current.installments, 2), maxInstallmentsForDate(current.firstPaymentDate)),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      setError("Enter a valid total price.");
      return;
    }

    const invalid = validateInstallmentSelection(
      form.paymentType,
      form.installments,
      form.firstPaymentDate,
    );

    if (invalid) {
      setError(invalid);
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in.");
      }

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
  user_id: user.id,
  name: form.name.trim(),
  email: form.email.trim(),
  phone: form.phone.trim(),
  cpf: form.cpf.trim(),
} as any)
        .select()
        .single();

      if (customerError) throw customerError;

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          user_id: user.id,
          customer_id: customer.id,
          sector: form.sector.trim(),
          batch: form.batch,
          payment_type: form.paymentType,
          total_price: Number(totalPrice.toFixed(2)),
          installments: form.installments,
          first_payment_date: form.firstPaymentDate,
          status: "PENDING",
        })
        .select()
        .single();

      if (saleError) throw saleError;

      const amounts = splitInstallmentAmounts(totalPrice, form.installments);
      const { error: paymentsError } = await supabase.from("payments").insert(
        amounts.map((amount, index) => ({
          user_id: user.id,
          sale_id: sale.id,
          installment_number: index + 1,
          amount,
          payment_date: addMonthsToISODate(form.firstPaymentDate, index),
          status: "pending",
          receipt_url: null,
        })),
      );

      if (paymentsError) throw paymentsError;

      await supabase.rpc("recalculate_sale_status", { target_sale_id: sale.id });
      router.push(`/sales/${sale.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create sale.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Registration</p>
        <h1 className="text-2xl font-semibold text-slate-950">Create sale</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Customer name
              </label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
<div>
  <label
    className="text-sm font-medium text-slate-700"
    htmlFor="cpf"
  >
    CPF
  </label>

 <input
  id="cpf"
  name="cpf"
  type="text"
  placeholder="000.000.000-00"
  value={form.cpf}
  onChange={(event) => updateField("cpf", event.target.value)}
  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
/>
</div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                Phone number
              </label>
              <input
                id="phone"
                required
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <select
  name="sector"
  defaultValue="PISTA"
  required
  className="w-full rounded-md border border-slate-300 px-3 py-2"
>
  <option value="PISTA">PISTA</option>
  <option value="FRONTSTAGE">FRONTSTAGE</option>
  <option value="LOUNGE">LOUNGE</option>
  <option value="BACKSTAGE ECO">BACKSTAGE ECO</option>
</select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="batch">
                Ticket batch
              </label>
           <select
  name="batch"
  defaultValue="PROMO"
  required
  className="w-full rounded-md border border-slate-300 px-3 py-2"
>
  <option value="PROMO">PROMO</option>
  <option value="LOTE 1">LOTE 1</option>
  <option value="LOTE 2">LOTE 2</option>
  <option value="LOTE 3">LOTE 3</option>
  <option value="LOTE 4">LOTE 4</option>
</select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="totalPrice">
                Total price
              </label>
              <input
                id="totalPrice"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.totalPrice}
                onChange={(event) => updateField("totalPrice", event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="firstPaymentDate">
                First payment date
              </label>
              <div className="relative mt-1">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="firstPaymentDate"
                  type="date"
                  required
                  value={form.firstPaymentDate}
                  onChange={(event) => updateFirstPaymentDate(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
                
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="paymentType">
                Payment type
              </label>
              <select
                id="paymentType"
                value={form.paymentType}
                onChange={(event) => updatePaymentType(event.target.value as PaymentType)}
                disabled={maxInstallments === 1}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              >
                 <option value="Full">Integral</option>
  <option value="Installment">Parcelado</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="installments">
                Number of installments
              </label>
              <select
  name="paymentType"
  value={form.paymentType}
  onChange={(event) =>
    updateField("paymentType", event.target.value as PaymentType)
  }
  required
  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
>
 
</select>
            </div>
          </div>

          {error || validationMessage ? (
            <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error || validationMessage}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving || Boolean(validationMessage)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? "Saving..." : "Create sale"}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Payment schedule</h2>
          <p className="mt-1 text-sm text-slate-500">
            Max installments for this date: {maxInstallments}
          </p>

          <div className="mt-4 divide-y divide-slate-100">
            {previewAmounts.length > 0 ? (
              previewAmounts.map((amount, index) => (
                <div key={index} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-950">Installment {index + 1}</p>
                    <p className="text-xs text-slate-500">
                      {addMonthsToISODate(form.firstPaymentDate, index)}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-950">{formatCurrency(amount)}</p>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-slate-500">Enter a price to preview installments.</p>
            )}
          </div>
        </section>
      </form>
    </div>
  );
}
