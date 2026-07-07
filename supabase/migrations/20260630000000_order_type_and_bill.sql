-- Adds order_type (dine-in vs takeaway) and bill_requested_at (customer "Bill"
-- button signal) so staff can see takeaway orders distinctly and get a
-- realtime ping the moment a customer asks for the bill.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dinein'
    CHECK (order_type IN ('dinein','takeaway')),
  ADD COLUMN IF NOT EXISTS bill_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_bill_requested_at_idx
  ON public.orders (bill_requested_at)
  WHERE bill_requested_at IS NOT NULL;
