
CREATE TABLE public.settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings public all" ON public.settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;

INSERT INTO public.settings (key, value) VALUES (
  'app',
  '{"paymentMethods":[{"id":"cbe","name":"Commercial Bank of Ethiopia (CBE)","account":"1000123456789","color":"blue"},{"id":"telebirr","name":"Telebirr","account":"0911 234 567","color":"green"},{"id":"ebirr","name":"E-birr","account":"0922 345 678","color":"orange"}]}'::jsonb
) ON CONFLICT (key) DO NOTHING;
