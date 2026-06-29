create table public.menus (
  id uuid not null default gen_random_uuid (),
  title character varying(255) not null,
  cook_count integer not null default 0,
  last_cooked_at date null,
  prev_cooked_at date null,
  created_at timestamp with time zone null default now(),
  is_cancelled boolean null default false,
  constraint menus_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_menus_cooking_info on public.menus using btree (cook_count, last_cooked_at) TABLESPACE pg_default;