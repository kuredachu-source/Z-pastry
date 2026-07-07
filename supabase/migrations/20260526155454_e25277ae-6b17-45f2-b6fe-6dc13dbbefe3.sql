
-- menu_items
CREATE TABLE public.menu_items (
  id BIGSERIAL PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_am TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.menu_items_id_seq TO anon, authenticated, service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_items public all" ON public.menu_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- orders
CREATE TABLE public.orders (
  id BIGSERIAL PRIMARY KEY,
  table_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.orders_id_seq TO anon, authenticated, service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders public all" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- order_items
CREATE TABLE public.order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id BIGINT NOT NULL,
  name_en TEXT NOT NULL,
  name_am TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated;
GRANT ALL ON public.order_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_items_id_seq TO anon, authenticated, service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items public all" ON public.order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- sentiment_logs
CREATE TABLE public.sentiment_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT,
  table_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentiment_logs TO anon, authenticated;
GRANT ALL ON public.sentiment_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sentiment_logs_id_seq TO anon, authenticated, service_role;
ALTER TABLE public.sentiment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sentiment_logs public all" ON public.sentiment_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- updated_at trigger for orders
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- Seed menu
INSERT INTO public.menu_items (name_en, name_am, description, price, category, image_url) VALUES
  ('Macchiato', 'ማኪያቶ', 'Espresso with a touch of steamed milk', 55, 'Coffee', 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600'),
  ('Buna', 'ቡና', 'Traditional Ethiopian coffee', 40, 'Coffee', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600'),
  ('Cappuccino', 'ካፑቺኖ', 'Espresso with foamed milk', 70, 'Coffee', 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600'),
  ('Tea', 'ሻይ', 'Black tea with spices', 25, 'Drinks', 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600'),
  ('Shiro Firfir', 'ሽሮ ፍርፍር', 'Spiced chickpea stew with injera', 180, 'Food', 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600'),
  ('Doro Wat', 'ዶሮ ወጥ', 'Spicy chicken stew', 260, 'Food', 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=600'),
  ('Cheesecake', 'ኬክ', 'Slice of classic cheesecake', 120, 'Dessert', 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600'),
  ('Fresh Juice', 'ጁስ', 'Mixed seasonal fruit juice', 80, 'Drinks', 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600');
