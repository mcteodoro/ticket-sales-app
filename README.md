# Ticket Sales Manager

A production-ready Next.js app for ticket sales with full and installment payments, Supabase Auth, Postgres RLS, and private receipt uploads.

## Features

- Email/password login with Supabase Auth.
- Create ticket sales with customer, sector, batch, price, first payment date, and payment type.
- Installment validation:
  - June or earlier: up to 5 installments.
  - July: up to 4 installments.
  - August: up to 3 installments.
  - September: up to 2 installments.
  - October or later: full payment only.
- Payment schedule generated automatically.
- Receipt upload to a private Supabase Storage bucket.
- Sale status refresh:
  - `EXPIRED` when installment 1 is unpaid after June 12 at 19:00 America/Sao_Paulo.
  - `RELEASED` when total paid is greater than or equal to total price.
  - `PENDING` otherwise.
- Ownership transfer by updating name, email, and phone without deleting payment history.
- No refund path in the UI, no delete grants, and a database trigger blocks paid installments returning to pending.
- Dashboard with total sales value, total received, pending sales, completed sales, and overdue customers.

## 1. Install

```bash
npm install
```

## 2. Configure Supabase

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

Legacy anon keys also work through `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but publishable keys are preferred for new Supabase projects.

## 3. Apply Database Schema

In the Supabase SQL Editor, run:

```sql
-- Copy and run:
-- supabase/migrations/0001_ticket_sales.sql
```

The migration creates:

- `customers`
- `sales`
- `payments`
- `receipts` private Storage bucket
- RLS policies for authenticated users
- Status refresh functions and payment triggers

The tables include `user_id` ownership columns so RLS can enforce per-user data access.

## 4. Auth Settings

In Supabase Authentication settings:

- Enable Email provider.
- For immediate internal use, you can disable email confirmation.
- If email confirmation stays enabled, set the confirmation URL to:

```text
https://your-domain.com/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

For local development, use:

```text
http://localhost:3000/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

## 5. Seed Data

Create one Auth user first, then run:

```sql
-- Copy and run:
-- supabase/seed.sql
```

The seed attaches demo customers, sales, and installments to the oldest Auth user.

## 6. Run Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 7. Deploy

Deploy to Vercel or any Next.js host. Add the same environment variables in the hosting dashboard, then apply the Supabase migration in the target project.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```
