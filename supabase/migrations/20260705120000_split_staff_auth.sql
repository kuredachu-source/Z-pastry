-- SECURITY FIX: the admin/worker passwords used to live inside the "app"
-- settings row — the exact same row the public QR menu fetches to read the
-- café location and payment methods. Any customer's browser could see the
-- plaintext passwords in that response. This migration moves them into a
-- separate "auth" row that the customer-facing menu never requests.

-- 1) Copy any existing passwords out of "app" into a new "auth" row
--    (falls back to the app's old hardcoded defaults if none were ever set).
INSERT INTO public.settings (key, value)
VALUES (
  'auth',
  jsonb_build_object(
    'adminPassword', COALESCE((SELECT value ->> 'adminPassword' FROM public.settings WHERE key = 'app'), 'admin123'),
    'workerPassword', COALESCE((SELECT value ->> 'workerPassword' FROM public.settings WHERE key = 'app'), 'worker123')
  )
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2) Strip the passwords out of the public "app" row so they stop being
--    sent to customers on every menu load.
UPDATE public.settings
SET value = (value - 'adminPassword') - 'workerPassword'
WHERE key = 'app';
