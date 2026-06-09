create extension if not exists pgcrypto;

create or replace function public.max_installments_for_payment_month(payment_date date)
returns integer
language sql
immutable
as $$
  select case
    when extract(month from payment_date)::integer <= 6 then 5
    when extract(month from payment_date)::integer = 7 then 4
    when extract(month from payment_date)::integer = 8 then 3
    when extract(month from payment_date)::integer = 9 then 2
    else 1
  end;
$$;

create or replace function public.first_payment_deadline(payment_date date)
returns timestamptz
language sql
immutable
as $$
  select make_timestamptz(
    extract(year from payment_date)::integer,
    6,
    12,
    19,
    0,
    0,
    'America/Sao_Paulo'
  );
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  email text not null check (position('@' in email) > 1),
  phone text not null check (char_length(trim(phone)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  sector text not null check (char_length(trim(sector)) > 0),
  batch text not null check (batch in ('Promo', 'Batch 1', 'Batch 2')),
  payment_type text not null check (payment_type in ('Full', 'Installments')),
  total_price numeric(12, 2) not null check (total_price > 0),
  installments integer not null check (installments >= 1),
  first_payment_date date not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'RELEASED', 'EXPIRED')),
  created_at timestamptz not null default now(),
  constraint sales_installment_rule check (
    (
      payment_type = 'Full'
      and installments = 1
    )
    or
    (
      payment_type = 'Installments'
      and installments between 2 and public.max_installments_for_payment_month(first_payment_date)
    )
  )
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete restrict,
  installment_number integer not null check (installment_number >= 1),
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null,
  status text not null default 'pending' check (status in ('paid', 'pending')),
  receipt_url text,
  created_at timestamptz not null default now(),
  unique (sale_id, installment_number)
);

create index if not exists customers_user_id_idx on public.customers(user_id);
create index if not exists sales_user_id_idx on public.sales(user_id);
create index if not exists sales_customer_id_idx on public.sales(customer_id);
create index if not exists sales_status_idx on public.sales(status);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_sale_id_idx on public.payments(sale_id);
create index if not exists payments_status_date_idx on public.payments(status, payment_date);

create or replace function public.recalculate_sale_status(target_sale_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sale_record public.sales%rowtype;
  paid_total numeric(12, 2);
  first_installment_paid boolean;
  next_status text;
begin
  select *
  into sale_record
  from public.sales
  where id = target_sale_id;

  if not found then
    return;
  end if;

  select coalesce(sum(amount), 0)
  into paid_total
  from public.payments
  where sale_id = target_sale_id
    and status = 'paid';

  select exists (
    select 1
    from public.payments
    where sale_id = target_sale_id
      and installment_number = 1
      and status = 'paid'
  )
  into first_installment_paid;

  if not first_installment_paid and now() >= public.first_payment_deadline(sale_record.first_payment_date) then
    next_status := 'EXPIRED';
  elsif paid_total >= sale_record.total_price then
    next_status := 'RELEASED';
  else
    next_status := 'PENDING';
  end if;

  update public.sales
  set status = next_status
  where id = target_sale_id;
end;
$$;

create or replace function public.refresh_sale_statuses()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sale_row record;
begin
  for sale_row in
    select id
    from public.sales
    where user_id = (select auth.uid())
  loop
    perform public.recalculate_sale_status(sale_row.id);
  end loop;
end;
$$;

create or replace function public.prevent_payment_refund()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'paid' and new.status <> 'paid' then
    raise exception 'No refunds allowed. Paid installments cannot be returned to pending.';
  end if;

  if old.status = 'paid' and old.receipt_url is not null and new.receipt_url is null then
    raise exception 'Receipt history cannot be removed from a paid installment.';
  end if;

  return new;
end;
$$;

create or replace function public.handle_payment_status_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.recalculate_sale_status(coalesce(new.sale_id, old.sale_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists prevent_payment_refund_trigger on public.payments;
create trigger prevent_payment_refund_trigger
before update on public.payments
for each row execute function public.prevent_payment_refund();

drop trigger if exists payments_recalculate_sale_status_trigger on public.payments;
create trigger payments_recalculate_sale_status_trigger
after insert or update on public.payments
for each row execute function public.handle_payment_status_change();

alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.sales to authenticated;
grant select, insert, update on public.payments to authenticated;
grant execute on function public.refresh_sale_statuses() to authenticated;
grant execute on function public.recalculate_sale_status(uuid) to authenticated;

drop policy if exists "Users can read own customers" on public.customers;
create policy "Users can read own customers"
on public.customers for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own customers" on public.customers;
create policy "Users can create own customers"
on public.customers for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own customers" on public.customers;
create policy "Users can update own customers"
on public.customers for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own sales" on public.sales;
create policy "Users can read own sales"
on public.sales for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own sales" on public.sales;
create policy "Users can create own sales"
on public.sales for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.customers
    where customers.id = sales.customer_id
      and customers.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own sales" on public.sales;
create policy "Users can update own sales"
on public.sales for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own payments" on public.payments;
create policy "Users can read own payments"
on public.payments for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own payments" on public.payments;
create policy "Users can create own payments"
on public.payments for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.sales
    where sales.id = payments.sale_id
      and sales.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own payments" on public.payments;
create policy "Users can update own payments"
on public.payments for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "Users can read own receipts" on storage.objects;
create policy "Users can read own receipts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can upload own receipts" on storage.objects;
create policy "Users can upload own receipts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update own receipts" on storage.objects;
create policy "Users can update own receipts"
on storage.objects for update
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
