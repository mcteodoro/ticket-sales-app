-- Run this after creating at least one Supabase Auth user.
-- The seed attaches demo data to the oldest auth user in the project.

do $$
declare
  owner_id uuid;
  customer_ada uuid := gen_random_uuid();
  customer_marcus uuid := gen_random_uuid();
  customer_lina uuid := gen_random_uuid();
  sale_ada uuid := gen_random_uuid();
  sale_marcus uuid := gen_random_uuid();
  sale_lina uuid := gen_random_uuid();
begin
  select id
  into owner_id
  from auth.users
  order by created_at
  limit 1;

  if owner_id is null then
    raise exception 'Create a Supabase Auth user before running seed.sql.';
  end if;

  insert into public.customers (id, user_id, name, email, phone)
  values
    (customer_ada, owner_id, 'Ada Brooks', 'ada@example.com', '+1 555 0100'),
    (customer_marcus, owner_id, 'Marcus Reed', 'marcus@example.com', '+1 555 0130'),
    (customer_lina, owner_id, 'Lina Patel', 'lina@example.com', '+1 555 0199')
  on conflict (id) do nothing;

  insert into public.sales (
    id,
    user_id,
    customer_id,
    sector,
    batch,
    payment_type,
    total_price,
    installments,
    first_payment_date,
    status
  )
  values
    (sale_ada, owner_id, customer_ada, 'VIP', 'Promo', 'Installments', 500.00, 5, date '2026-06-10', 'PENDING'),
    (sale_marcus, owner_id, customer_marcus, 'Floor', 'Batch 1', 'Installments', 360.00, 3, date '2026-08-05', 'PENDING'),
    (sale_lina, owner_id, customer_lina, 'Balcony', 'Batch 2', 'Full', 180.00, 1, date '2026-10-01', 'PENDING')
  on conflict (id) do nothing;

  insert into public.payments (
    user_id,
    sale_id,
    installment_number,
    amount,
    payment_date,
    status,
    receipt_url
  )
  values
    (owner_id, sale_ada, 1, 100.00, date '2026-06-10', 'paid', owner_id::text || '/seed/ada-1.pdf'),
    (owner_id, sale_ada, 2, 100.00, date '2026-07-10', 'pending', null),
    (owner_id, sale_ada, 3, 100.00, date '2026-08-10', 'pending', null),
    (owner_id, sale_ada, 4, 100.00, date '2026-09-10', 'pending', null),
    (owner_id, sale_ada, 5, 100.00, date '2026-10-10', 'pending', null),
    (owner_id, sale_marcus, 1, 120.00, date '2026-08-05', 'pending', null),
    (owner_id, sale_marcus, 2, 120.00, date '2026-09-05', 'pending', null),
    (owner_id, sale_marcus, 3, 120.00, date '2026-10-05', 'pending', null),
    (owner_id, sale_lina, 1, 180.00, date '2026-10-01', 'pending', null)
  on conflict (sale_id, installment_number) do nothing;

  perform public.recalculate_sale_status(sale_ada);
  perform public.recalculate_sale_status(sale_marcus);
  perform public.recalculate_sale_status(sale_lina);
end $$;
