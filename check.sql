select id, name_en, length(image_url) as url_length
from public.menu_items
where image_url like 'data:%'
order by url_length desc;