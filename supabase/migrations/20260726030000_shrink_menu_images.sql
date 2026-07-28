update public.menu_items
set image_url = image_url || '?width=400'
where image_url like '%commons.wikimedia.org%' and image_url not like '%width=%';