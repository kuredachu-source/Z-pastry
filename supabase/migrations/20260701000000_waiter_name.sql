-- Adds waiter_name so staff can record who served each order, for the
-- Reports dashboard (date, time, waiter, table/order, item, qty, price...).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS waiter_name text;
