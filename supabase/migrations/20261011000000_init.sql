-- SNACKEATS — esquema inicial
-- Principios: cada fila de usuario lleva user_id; RLS activado en TODAS las tablas;
-- el rol anon no tiene acceso a datos de usuario; los cambios de facturación sólo
-- los hace el servidor (service_role) tras verificar el webhook de Stripe.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Utilidades
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Planes (configurables sin tocar código) y suscripciones
-- ─────────────────────────────────────────────────────────────────────────────
create table public.plans (
  id text primary key,
  name text not null,
  description text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'eur',
  billing_interval text check (billing_interval in ('month', 'year')),
  stripe_price_id text,
  -- límites mensuales por tipo de operación + límites de ráfaga
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort integer not null default 0
);

-- LÍMITES PROVISIONALES: deben ajustarse con el coste real medido (usage_events guarda los tokens).
insert into public.plans (id, name, description, price_cents, billing_interval, limits, features, sort) values
  ('guest', 'Invitado', 'Prueba sin registrarte', 0, null,
   '{"scan": 2, "generate": 2, "adapt": 2, "saved_recipes": 5, "per_minute": 3}',
   '["Prueba el escáner y el generador sin crear cuenta"]', 0),
  ('free', 'Gratis', 'Para cocinar mejor cada día', 0, null,
   '{"scan": 5, "generate": 10, "adapt": 10, "saved_recipes": 30, "per_minute": 5}',
   '["5 escaneos al mes", "10 generaciones y 10 adaptaciones de recetas al mes", "Cálculo nutricional completo", "30 recetas guardadas", "Planificador y lista de la compra"]', 1),
  ('premium', 'Premium', 'Para quien cocina con objetivos', 499, 'month',
   '{"scan": 60, "generate": 150, "adapt": 150, "saved_recipes": 2000, "per_minute": 10}',
   '["60 escaneos al mes", "150 generaciones y 150 adaptaciones al mes", "Ajuste avanzado a calorías y macros", "Hasta 2.000 recetas guardadas", "Historial completo y colecciones"]', 2);

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Perfil
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  locale text not null default 'es' check (locale in ('es', 'en')),
  region text not null default 'ES' check (char_length(region) between 2 and 8),
  profile_type text not null default 'cotidiana' check (profile_type in ('cotidiana', 'equilibrada', 'deporte', 'batch', 'economica', 'rapida')),
  cooking_level text not null default 'basico' check (cooking_level in ('principiante', 'basico', 'intermedio', 'avanzado')),
  usual_minutes integer check (usual_minutes between 5 and 300),
  budget text check (budget in ('bajo', 'medio', 'alto')),
  default_servings integer not null default 2 check (default_servings between 1 and 20),
  allergies text[] not null default '{}',
  intolerances text[] not null default '{}',
  diets text[] not null default '{}',
  dislikes text[] not null default '{}',
  favorites text[] not null default '{}',
  default_targets jsonb,
  personalization_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allergies_valid check (allergies <@ array['gluten','crustaceos','huevo','pescado','cacahuete','soja','leche','frutos_cascara','apio','mostaza','sesamo','sulfitos','altramuces','moluscos']::text[]),
  constraint diets_valid check (diets <@ array['vegetariana','vegana','pescetariana','sin_gluten','sin_lactosa']::text[]),
  constraint lists_size check (cardinality(dislikes) <= 100 and cardinality(favorites) <= 100 and cardinality(intolerances) <= 20)
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Crea el perfil automáticamente al registrarse (también para cuentas anónimas).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Alimentos personalizados (valores copiados de la etiqueta por el usuario)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kcal numeric not null check (kcal >= 0 and kcal <= 900),
  protein numeric not null check (protein >= 0 and protein <= 100),
  carbs numeric not null check (carbs >= 0 and carbs <= 100),
  fat numeric not null check (fat >= 0 and fat <= 100),
  fiber numeric check (fiber >= 0 and fiber <= 100),
  sugars numeric check (sugars >= 0 and sugars <= 100),
  sat_fat numeric check (sat_fat >= 0 and sat_fat <= 100),
  sodium_mg numeric check (sodium_mg >= 0 and sodium_mg <= 40000),
  unit_grams numeric check (unit_grams > 0 and unit_grams <= 5000),
  allergens text[] not null default '{}',
  category text not null default 'otros',
  created_at timestamptz not null default now()
);
create index custom_foods_user on public.custom_foods (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Recetas, versiones y colecciones
-- ─────────────────────────────────────────────────────────────────────────────
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 200000),
  servings integer not null check (servings between 1 and 50),
  kcal_per_serving numeric,
  protein_per_serving numeric,
  carbs_per_serving numeric,
  fat_per_serving numeric,
  targets jsonb,
  source text not null default 'ai' check (source in ('ai', 'manual', 'adapted')),
  parent_id uuid references public.recipes (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  is_favorite boolean not null default false,
  image_url text check (image_url is null or image_url like 'https://%'),
  image_credit text,
  last_cooked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_user_created on public.recipes (user_id, created_at desc);
create index recipes_parent on public.recipes (parent_id);
create trigger recipes_updated before update on public.recipes for each row execute function public.set_updated_at();

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create index collections_user on public.collections (user_id);

create table public.collection_recipes (
  collection_id uuid not null references public.collections (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Despensa
-- ─────────────────────────────────────────────────────────────────────────────
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  food_key text,
  quantity numeric check (quantity is null or quantity >= 0),
  unit text not null default 'g' check (unit in ('g', 'kg', 'ml', 'l', 'unidad', 'cda', 'cdta', 'taza', 'pizca')),
  location text not null default 'despensa' check (location in ('nevera', 'congelador', 'despensa')),
  status text not null default 'disponible' check (status in ('disponible', 'agotado', 'revisar')),
  food_state text check (food_state in ('crudo', 'cocinado', 'congelado', 'conserva')),
  purchased_on date,
  expires_on date,
  date_kind text check (date_kind in ('caducidad', 'consumo_preferente')),
  use_first boolean not null default false,
  low_threshold numeric check (low_threshold is null or low_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint date_kind_requires_date check (date_kind is null or expires_on is not null)
);
create index pantry_user on public.pantry_items (user_id);
create trigger pantry_updated before update on public.pantry_items for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Planificador semanal
-- ─────────────────────────────────────────────────────────────────────────────
create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_date date not null,
  slot text not null check (slot in ('desayuno', 'media_manana', 'comida', 'merienda', 'cena', 'snack')),
  position integer not null default 0,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  servings numeric not null default 1 check (servings > 0 and servings <= 50),
  created_at timestamptz not null default now()
);
create index meal_plan_user_date on public.meal_plan_entries (user_id, plan_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Lista de la compra
-- ─────────────────────────────────────────────────────────────────────────────
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_key text,
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric check (quantity is null or quantity >= 0),
  unit text not null default 'g',
  category text not null default 'otros',
  checked boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'plan', 'recipe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_user on public.shopping_items (user_id);
create trigger shopping_updated before update on public.shopping_items for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Historial de búsquedas
-- ─────────────────────────────────────────────────────────────────────────────
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query text not null check (char_length(query) between 1 and 500),
  kind text not null default 'dish' check (kind in ('dish', 'ingredients', 'scan')),
  created_at timestamptz not null default now()
);
create index search_history_user on public.search_history (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Consumo de IA (cuotas y control de costes). Sin contenido de usuario.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('scan', 'generate', 'adapt')),
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index usage_user_kind_created on public.usage_events (user_id, kind, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Funciones de negocio
-- ─────────────────────────────────────────────────────────────────────────────

-- Plan efectivo del usuario actual.
create or replace function public.current_plan_id(p_user uuid default auth.uid()) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.plan_id from public.subscriptions s
      where s.user_id = p_user
        and s.status in ('active', 'trialing')
        and (s.current_period_end is null or s.current_period_end > now())),
    case when coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then 'guest' else 'free' end
  )
$$;

-- Comprueba y consume cuota de forma atómica (evita carreras con peticiones en paralelo).
create or replace function public.consume_quota(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_plan text;
  v_limits jsonb;
  v_limit integer;
  v_per_minute integer;
  v_used integer;
  v_recent integer;
  v_id bigint;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('scan', 'generate', 'adapt') then
    raise exception 'invalid_kind';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  v_plan := public.current_plan_id(v_user);
  select limits into v_limits from public.plans where id = v_plan;
  v_limit := coalesce((v_limits ->> p_kind)::integer, 0);
  v_per_minute := coalesce((v_limits ->> 'per_minute')::integer, 5);

  select count(*) into v_used from public.usage_events
    where user_id = v_user and kind = p_kind and created_at >= date_trunc('month', now());
  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'reason', 'quota', 'plan', v_plan, 'used', v_used, 'limit', v_limit);
  end if;

  select count(*) into v_recent from public.usage_events
    where user_id = v_user and created_at >= now() - interval '1 minute';
  if v_recent >= v_per_minute then
    return jsonb_build_object('allowed', false, 'reason', 'rate', 'plan', v_plan, 'used', v_used, 'limit', v_limit);
  end if;

  insert into public.usage_events (user_id, kind) values (v_user, p_kind) returning id into v_id;
  return jsonb_build_object('allowed', true, 'event_id', v_id, 'plan', v_plan, 'used', v_used + 1, 'limit', v_limit);
end $$;

-- Uso del mes (para mostrarlo en la interfaz).
create or replace function public.usage_summary() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plan', public.current_plan_id(auth.uid()),
    'limits', (select limits from public.plans where id = public.current_plan_id(auth.uid())),
    'used', coalesce((select jsonb_object_agg(kind, n) from (
      select kind, count(*) as n from public.usage_events
       where user_id = auth.uid() and created_at >= date_trunc('month', now())
       group by kind) t), '{}'::jsonb),
    'saved_recipes', (select count(*) from public.recipes where user_id = auth.uid())
  )
$$;

-- Devuelve la cuota si la llamada a la IA falló (sólo el servidor puede hacerlo).
create or replace function public.release_quota(p_event_id bigint) returns void
language sql security definer set search_path = public as $$
  delete from public.usage_events where id = p_event_id and created_at > now() - interval '15 minutes';
$$;

-- Registra el consumo de tokens (sólo el servidor).
create or replace function public.record_usage_tokens(p_event_id bigint, p_model text, p_in integer, p_out integer) returns void
language sql security definer set search_path = public as $$
  update public.usage_events set model = p_model, input_tokens = p_in, output_tokens = p_out where id = p_event_id;
$$;

-- Límite de recetas guardadas según el plan (aplicado en la base de datos).
create or replace function public.enforce_saved_recipes_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1));
  select (limits ->> 'saved_recipes')::integer into v_limit from public.plans where id = public.current_plan_id(new.user_id);
  select count(*) into v_count from public.recipes where user_id = new.user_id;
  if v_limit is not null and v_count >= v_limit then
    raise exception 'saved_recipes_limit' using errcode = 'P0001', hint = 'Has alcanzado el máximo de recetas guardadas de tu plan.';
  end if;
  return new;
end $$;
create trigger recipes_limit before insert on public.recipes for each row execute function public.enforce_saved_recipes_limit();

-- ─────────────────────────────────────────────────────────────────────────────
-- Seguridad: RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.profiles enable row level security;
alter table public.custom_foods enable row level security;
alter table public.recipes enable row level security;
alter table public.collections enable row level security;
alter table public.collection_recipes enable row level security;
alter table public.pantry_items enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.shopping_items enable row level security;
alter table public.search_history enable row level security;
alter table public.usage_events enable row level security;

-- Planes: lectura pública de los activos.
create policy plans_read on public.plans for select to anon, authenticated using (active);

-- Suscripción: el usuario sólo puede LEER la suya. Escrituras: sólo service_role (webhook).
create policy subscriptions_read_own on public.subscriptions for select to authenticated using (user_id = auth.uid());

-- Perfil
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Comprobaciones de propiedad sin recursión de políticas (security definer, sólo lectura).
create or replace function public.owns_recipe(p_recipe uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.recipes where id = p_recipe and user_id = auth.uid())
$$;
create or replace function public.owns_collection(p_collection uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.collections where id = p_collection and user_id = auth.uid())
$$;

-- Tablas con propietario directo: CRUD sólo sobre filas propias.
create policy custom_foods_own on public.custom_foods for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collections_own on public.collections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pantry_own on public.pantry_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shopping_own on public.shopping_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy history_own on public.search_history for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy recipes_own on public.recipes for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (parent_id is null or public.owns_recipe(parent_id))
  );

-- El plan sólo puede apuntar a recetas propias.
create policy meal_plan_own on public.meal_plan_entries for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_recipe(recipe_id));

-- Colección y receta deben ser del mismo usuario.
create policy collection_recipes_own on public.collection_recipes for all to authenticated
  using (public.owns_collection(collection_id))
  with check (public.owns_collection(collection_id) and public.owns_recipe(recipe_id));

-- Consumo: lectura propia; sin escritura directa (sólo vía consume_quota).
create policy usage_read_own on public.usage_events for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: el rol anon no accede a datos de usuario.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on public.subscriptions, public.profiles, public.custom_foods, public.recipes, public.collections,
  public.collection_recipes, public.pantry_items, public.meal_plan_entries, public.shopping_items,
  public.search_history, public.usage_events from anon;
revoke insert, update, delete on public.plans from anon, authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
revoke insert, update, delete on public.usage_events from authenticated;
revoke insert, delete on public.profiles from authenticated;

revoke execute on function public.release_quota(bigint) from public, anon, authenticated;
revoke execute on function public.record_usage_tokens(bigint, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.consume_quota(text) from public, anon;
revoke execute on function public.usage_summary() from public, anon;
revoke execute on function public.current_plan_id(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_saved_recipes_limit() from public, anon, authenticated;
revoke execute on function public.owns_recipe(uuid) from public, anon;
revoke execute on function public.owns_collection(uuid) from public, anon;
grant execute on function public.owns_recipe(uuid) to authenticated;
grant execute on function public.owns_collection(uuid) to authenticated;
grant execute on function public.consume_quota(text) to authenticated;
grant execute on function public.usage_summary() to authenticated;
grant execute on function public.release_quota(bigint) to service_role;
grant execute on function public.record_usage_tokens(bigint, text, integer, integer) to service_role;
