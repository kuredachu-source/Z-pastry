-- The staff order queue filters/sorts orders by status constantly (both in
-- the client query and in the realtime-triggered refetch). Without this
-- index, that's a sequential scan over the entire orders table, which only
-- gets slower as order history grows.
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status, created_at);
