-- push_subscriptions: Web Push subscriptions tied to a specific order, so we
-- can notify a customer's device the instant staff mark their order "ready"
-- — even if they've closed the ordering page or their phone is locked.
CREATE TABLE public.push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, endpoint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.push_subscriptions_id_seq TO anon, authenticated, service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subscriptions public all" ON public.push_subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- order_messages: a lightweight two-way chat between the customer at a table
-- and staff, scoped to one order — e.g. customer asks "is my food coming?"
-- and a staff member replies from the order queue.
CREATE TABLE public.order_messages (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'staff')),
  message TEXT NOT NULL,
  waiter_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_messages TO anon, authenticated;
GRANT ALL ON public.order_messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_messages_id_seq TO anon, authenticated, service_role;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_messages public all" ON public.order_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS order_messages_order_id_idx ON public.order_messages (order_id, created_at);

-- Realtime
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
