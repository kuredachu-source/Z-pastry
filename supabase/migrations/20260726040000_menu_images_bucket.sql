insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "Anyone can upload menu images"
on storage.objects for insert
with check (bucket_id = 'menu-images');

create policy "Anyone can view menu images"
on storage.objects for select
using (bucket_id = 'menu-images');