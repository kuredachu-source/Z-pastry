ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;