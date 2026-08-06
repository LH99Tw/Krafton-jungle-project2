alter table public.blogs
  add column if not exists shop_name text not null default '취향을 나누는 상점',
  add column if not exists shop_description text not null default '직접 모으고 아껴온 물건을 다음 주인에게 건넵니다.';

alter table public.blogs
  drop constraint if exists blogs_shop_name_length,
  drop constraint if exists blogs_shop_description_length;

alter table public.blogs
  add constraint blogs_shop_name_length check (char_length(shop_name) between 1 and 40),
  add constraint blogs_shop_description_length check (char_length(shop_description) <= 120);
