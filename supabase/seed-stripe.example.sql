-- Ejecutar en Supabase → SQL Editor DESPUÉS de crear el producto y el precio en Stripe.
-- Sustituye price_XXXX por el ID del precio mensual de Premium.
update public.plans set stripe_price_id = 'price_XXXX' where id = 'premium';

-- Cambiar límites o precio mostrado sin tocar código (el cobro real lo define Stripe):
-- update public.plans set limits = '{"scan": 60, "generate": 150, "adapt": 150, "saved_recipes": 2000, "per_minute": 10}' where id = 'premium';
-- update public.plans set price_cents = 499 where id = 'premium';

-- Coste real medido de la IA (tokens por operación en los últimos 30 días):
-- select kind, model, count(*), avg(input_tokens)::int as in_avg, avg(output_tokens)::int as out_avg
--   from public.usage_events where created_at > now() - interval '30 days' and model is not null group by 1, 2;
