export type PaymentStatus = "paid" | "pending";
export type SaleStatus = "PENDING" | "RELEASED" | "EXPIRED";
export type PaymentType = "Full" | "Installments";
export type TicketBatch = "Promo" | "Batch 1" | "Batch 2";

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
};

export type Sale = {
  id: string;
  user_id: string;
  customer_id: string;
  sector: string;
  batch: TicketBatch;
  payment_type: PaymentType;
  total_price: number;
  installments: number;
  first_payment_date: string;
  status: SaleStatus;
  created_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  sale_id: string;
  installment_number: number;
  amount: number;
  payment_date: string;
  status: PaymentStatus;
  receipt_url: string | null;
  created_at: string;
};

export type SaleWithRelations = Sale & {
  customers: Customer | null;
  payments: Payment[];
};

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: Customer;
        Insert: Omit<Customer, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Customer, "id" | "created_at">>;
        Relationships: [];
      };
      sales: {
        Row: Sale;
        Insert: Omit<Sale, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Sale, "id" | "created_at">>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Payment, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      refresh_sale_statuses: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      recalculate_sale_status: {
        Args: { target_sale_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
