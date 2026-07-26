alter table public.order_messages add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('bill-photos', 'bill-photos', true)
on conflict (id) do nothing;

create policy "Anyone can upload bill photos"
on storage.objects for insert
with check (bucket_id = 'bill-photos');

create policy "Anyone can view bill photos"
on storage.objects for select
using (bucket_id = 'bill-photos');