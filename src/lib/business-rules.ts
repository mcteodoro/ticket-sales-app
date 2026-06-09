import type { PaymentType, SaleStatus } from "@/lib/types";

export const BATCHES = ["Promo", "Batch 1", "Batch 2"] as const;
export const PAYMENT_TYPES = ["Full", "Installments"] as const;

export function maxInstallmentsForDate(dateValue: string) {
  if (!dateValue) {
    return 1;
  }

  const [, rawMonth] = dateValue.split("-").map(Number);
  const month = rawMonth || 12;

  if (month <= 6) return 5;
  if (month === 7) return 4;
  if (month === 8) return 3;
  if (month === 9) return 2;
  return 1;
}

export function validateInstallmentSelection(
  paymentType: PaymentType,
  installments: number,
  firstPaymentDate: string,
) {
  const maxInstallments = maxInstallmentsForDate(firstPaymentDate);

  if (paymentType === "Full" && installments !== 1) {
    return "Full payments must use one installment.";
  }

  if (paymentType === "Installments" && installments < 2) {
    return "Installment payments must use at least two installments.";
  }

  if (installments > maxInstallments) {
    return `This first payment date allows up to ${maxInstallments} installment${
      maxInstallments === 1 ? "" : "s"
    }.`;
  }

  if (maxInstallments === 1 && paymentType !== "Full") {
    return "October or later requires full payment.";
  }

  return null;
}

export function splitInstallmentAmounts(totalPrice: number, installments: number) {
  const totalCents = Math.round(totalPrice * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainder = totalCents - baseCents * installments;

  return Array.from({ length: installments }, (_, index) => {
    const cents = index === installments - 1 ? baseCents + remainder : baseCents;
    return Number((cents / 100).toFixed(2));
  });
}

export function addMonthsToISODate(dateValue: string, monthsToAdd: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + monthsToAdd, day));
  return date.toISOString().slice(0, 10);
}

export function firstPaymentDeadline(firstPaymentDate: string) {
  const [year] = firstPaymentDate.split("-").map(Number);
  return new Date(`${year}-06-12T19:00:00-03:00`);
}

export function calculateSaleStatus(args: {
  firstPaymentDate: string;
  totalPrice: number;
  totalPaid: number;
  firstInstallmentPaid: boolean;
  now?: Date;
}): SaleStatus {
  const now = args.now ?? new Date();

  if (!args.firstInstallmentPaid && now >= firstPaymentDeadline(args.firstPaymentDate)) {
    return "EXPIRED";
  }

  if (args.totalPaid >= args.totalPrice) {
    return "RELEASED";
  }

  return "PENDING";
}
