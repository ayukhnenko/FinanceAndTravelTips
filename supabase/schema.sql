-- Run this in Supabase SQL editor once.

create table if not exists public.app_counters (
  key text primary key,
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.increment_counter(p_key text)
returns bigint
language plpgsql
security definer
as $$
declare
  next_value bigint;
begin
  insert into public.app_counters as c (key, value)
  values (p_key, 1)
  on conflict (key)
  do update set
    value = c.value + 1,
    updated_at = now()
  returning value into next_value;

  return next_value;
end;
$$;

create table if not exists public.app_settings_rates (
  id bigint generated always as identity primary key,
  parameter text not null,
  effective_date date not null,
  rate numeric(8,4) not null check (rate > 0 and rate < 200),
  created_at timestamptz not null default now(),
  unique (parameter, effective_date)
);

create index if not exists app_settings_rates_parameter_date_idx
  on public.app_settings_rates (parameter, effective_date desc);
