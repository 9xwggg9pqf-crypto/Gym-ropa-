-- Pruebas de seguridad (Caso J) y persistencia (Caso H) sobre el esquema real.
-- Cada bloque falla con una excepción si una comprobación no se cumple.
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-00000000000c', true);

-- El trigger crea los perfiles
do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'FALLO: perfiles no creados automáticamente'; end if;
end $$;

create or replace function pg_temp.as_user(p uuid, anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated', 'is_anonymous', anon)::text, false);
end $$;

-- ── Usuario A crea datos ──────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into public.recipes (id, title, data, servings, kcal_per_serving) values
  ('10000000-0000-0000-0000-000000000001', 'Pollo con arroz de A', '{"title":"Pollo con arroz"}', 2, 650);
insert into public.pantry_items (name, food_key, quantity, unit) values ('Arroz', 'arroz_blanco_crudo', 1000, 'g');
insert into public.shopping_items (name) values ('Tomates');
insert into public.collections (id, name) values ('20000000-0000-0000-0000-000000000001', 'Favoritas A');
insert into public.collection_recipes (collection_id, recipe_id) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
insert into public.meal_plan_entries (plan_date, slot, recipe_id, servings) values (current_date, 'comida', '10000000-0000-0000-0000-000000000001', 1);
insert into public.search_history (query) values ('pollo con arroz 650 kcal');
insert into public.custom_foods (name, kcal, protein, carbs, fat) values ('Mi whey', 380, 80, 6, 5);
update public.profiles set allergies = '{leche}' where id = auth.uid();
reset role;

-- ── Caso H: la receta sigue ahí al volver a "iniciar sesión" ─────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ begin
  if (select count(*) from public.recipes) <> 1 then raise exception 'FALLO H: A no ve su receta'; end if;
  if (select allergies from public.profiles where id = auth.uid()) <> '{leche}' then raise exception 'FALLO H: perfil no persistido'; end if;
end $$;
reset role;

-- ── Caso J: B no puede ver ni modificar nada de A ─────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$
declare n int;
begin
  if (select count(*) from public.recipes) <> 0 then raise exception 'FALLO J: B ve recetas de A'; end if;
  if (select count(*) from public.pantry_items) <> 0 then raise exception 'FALLO J: B ve la despensa de A'; end if;
  if (select count(*) from public.shopping_items) <> 0 then raise exception 'FALLO J: B ve la lista de A'; end if;
  if (select count(*) from public.collections) <> 0 then raise exception 'FALLO J: B ve colecciones de A'; end if;
  if (select count(*) from public.collection_recipes) <> 0 then raise exception 'FALLO J: B ve collection_recipes de A'; end if;
  if (select count(*) from public.meal_plan_entries) <> 0 then raise exception 'FALLO J: B ve el plan de A'; end if;
  if (select count(*) from public.search_history) <> 0 then raise exception 'FALLO J: B ve el historial de A'; end if;
  if (select count(*) from public.custom_foods) <> 0 then raise exception 'FALLO J: B ve alimentos de A'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'FALLO J: B ve perfiles ajenos'; end if;
  if (select count(*) from public.usage_events) <> 0 then raise exception 'FALLO J: B ve consumo ajeno'; end if;

  update public.recipes set title = 'hackeado' where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO J: B modificó una receta de A'; end if;
  delete from public.recipes where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO J: B borró una receta de A'; end if;
  update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO J: B modificó el perfil de A'; end if;

  begin
    insert into public.recipes (user_id, title, data, servings) values ('00000000-0000-0000-0000-00000000000a', 'inyectada', '{}', 1);
    raise exception 'FALLO J: B creó una receta a nombre de A';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.meal_plan_entries (plan_date, slot, recipe_id) values (current_date, 'cena', '10000000-0000-0000-0000-000000000001');
    raise exception 'FALLO J: B planificó una receta de A';
  exception when insufficient_privilege then null; end;

  insert into public.collections (id, name) values ('20000000-0000-0000-0000-000000000002', 'Col B');
  begin
    insert into public.collection_recipes (collection_id, recipe_id) values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');
    raise exception 'FALLO J: B añadió una receta de A a su colección';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.recipes (title, data, servings, parent_id) values ('versión', '{}', 1, '10000000-0000-0000-0000-000000000001');
    raise exception 'FALLO J: B creó una versión de una receta de A';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.subscriptions (user_id, plan_id, status) values (auth.uid(), 'premium', 'active');
    raise exception 'FALLO J: B se activó Premium a sí mismo';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.usage_events (user_id, kind) values (auth.uid(), 'scan');
    raise exception 'FALLO J: B escribió consumo directamente';
  exception when insufficient_privilege then null; end;

  begin
    perform public.release_quota(1);
    raise exception 'FALLO J: B pudo devolverse cuota';
  exception when insufficient_privilege then null; end;

  begin
    update public.plans set limits = '{"scan": 99999}' where id = 'free';
    raise exception 'FALLO J: B modificó los planes';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── anon no accede a datos de usuario ─────────────────────────────────────
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
do $$ begin
  begin
    perform count(*) from public.recipes;
    raise exception 'FALLO J: anon puede leer recetas';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.plans) < 2 then raise exception 'FALLO: anon no puede ver los planes'; end if;
  begin
    perform public.consume_quota('scan');
    raise exception 'FALLO J: anon consumió cuota';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Cuotas: plan gratuito y límite por minuto ─────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$
declare r jsonb; i int;
begin
  for i in 1..5 loop
    r := public.consume_quota('scan');
    if not (r ->> 'allowed')::boolean then raise exception 'FALLO cuota: denegada antes de tiempo en %', i; end if;
  end loop;
  r := public.consume_quota('generate');
  if (r ->> 'allowed')::boolean or r ->> 'reason' <> 'rate' then raise exception 'FALLO cuota: no se aplicó el límite por minuto: %', r; end if;
  if (public.usage_summary() -> 'used' ->> 'scan')::int <> 5 then raise exception 'FALLO resumen de uso'; end if;
end $$;
reset role;

-- Simula el paso del tiempo para probar el límite mensual
update public.usage_events set created_at = now() - interval '2 minutes' where user_id = '00000000-0000-0000-0000-00000000000b';
insert into public.usage_events (user_id, kind, created_at)
  select '00000000-0000-0000-0000-00000000000b', 'scan', now() - interval '3 minutes' from generate_series(1, 5);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ declare r jsonb; begin
  r := public.consume_quota('scan');
  if (r ->> 'allowed')::boolean or r ->> 'reason' <> 'quota' then raise exception 'FALLO cuota mensual: %', r; end if;
  if r ->> 'plan' <> 'free' then raise exception 'FALLO plan efectivo: %', r; end if;
end $$;
reset role;

-- Premium activado por el servidor (service_role) amplía el límite
set role service_role;
insert into public.subscriptions (user_id, plan_id, status, current_period_end)
  values ('00000000-0000-0000-0000-00000000000b', 'premium', 'active', now() + interval '30 days');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ declare r jsonb; begin
  r := public.consume_quota('scan');
  if not (r ->> 'allowed')::boolean or r ->> 'plan' <> 'premium' then raise exception 'FALLO premium: %', r; end if;
end $$;
reset role;

-- ── Invitado (cuenta anónima): plan guest y límite de recetas guardadas ───
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c', true);
set role authenticated;
do $$ declare i int; begin
  if public.usage_summary() ->> 'plan' <> 'guest' then raise exception 'FALLO: anónimo no tiene plan guest'; end if;
  for i in 1..5 loop
    insert into public.recipes (title, data, servings) values ('r' || i, '{}', 1);
  end loop;
  begin
    insert into public.recipes (title, data, servings) values ('sobra', '{}', 1);
    raise exception 'FALLO: se superó el límite de recetas guardadas';
  exception when raise_exception then
    if sqlerrm <> 'saved_recipes_limit' then raise; end if;
  end;
end $$;
reset role;

-- ── Borrado de cuenta: cascada completa ───────────────────────────────────
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if exists (select 1 from public.recipes where user_id = '00000000-0000-0000-0000-00000000000a')
     or exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000a')
     or exists (select 1 from public.pantry_items where user_id = '00000000-0000-0000-0000-00000000000a')
     or exists (select 1 from public.custom_foods where user_id = '00000000-0000-0000-0000-00000000000a')
  then raise exception 'FALLO: quedan datos tras borrar la cuenta'; end if;
end $$;

select 'OK: todas las pruebas de RLS, cuotas y persistencia han pasado' as resultado;
