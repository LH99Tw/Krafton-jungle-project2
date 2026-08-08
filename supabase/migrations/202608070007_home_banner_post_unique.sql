drop index if exists public.home_banners_post_id_unique;

create unique index home_banners_post_id_unique
  on public.home_banners (post_id);
