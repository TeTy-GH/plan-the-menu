create table public.menu_ingredients (
  menu_id uuid not null,
  ingredient_id uuid not null,
  constraint menu_ingredients_pkey primary key (menu_id, ingredient_id),
  constraint menu_ingredients_ingredient_id_fkey foreign KEY (ingredient_id) references ingredients (id) on delete CASCADE,
  constraint menu_ingredients_menu_id_fkey foreign KEY (menu_id) references menus (id) on delete CASCADE
) TABLESPACE pg_default;