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

-- Параметры приложения (URL ЦБ, Google Sheets и др.) — ключ/значение.
create table if not exists public.app_settings_params (
  parameter text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.app_deposit_offers (
  id bigint generated always as identity primary key,
  sort_order int not null default 0,
  beacon text not null default '',
  nominal_rate_percent numeric(8,4),
  rate_monthly_equiv_percent numeric(8,4),
  rate_end_equiv_percent numeric(8,4),
  rate_annual_equiv_percent numeric(8,4),
  interest_payment_type text not null default '',
  interest_payment_timing text not null default '',
  term_years numeric(8,4),
  term_days int,
  bank_name text not null default '',
  region text not null default '',
  assets_rank text not null default '',
  rating text not null default '',
  product_name text not null default '',
  min_amount_thousands text not null default '',
  replenishment text not null default '',
  withdrawal text not null default '',
  conditions text not null default '',
  max_amount_text text not null default '',
  data_source text not null default '',
  product_url text not null default '',
  raw_row jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists app_deposit_offers_synced_at_idx
  on public.app_deposit_offers (synced_at desc);

create index if not exists app_deposit_offers_bank_idx
  on public.app_deposit_offers (bank_name);

alter table public.app_deposit_offers
  add column if not exists max_amount_text text not null default '';

alter table public.app_deposit_offers
  add column if not exists data_source text not null default '';

create index if not exists app_deposit_offers_data_source_idx
  on public.app_deposit_offers (data_source);

-- Журнал загрузок ставки ЦБ и вкладов в БД.
create table if not exists public.app_sync_logs (
  id bigint generated always as identity primary key,
  sync_kind text not null check (sync_kind in ('key_rate', 'deposits')),
  status text not null check (status in ('success', 'error')),
  source text not null default '',
  trigger_source text not null default '',
  inserted_count int not null default 0,
  rate numeric(8,4),
  effective_date date,
  error_message text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_sync_logs_created_at_idx
  on public.app_sync_logs (created_at desc);

create index if not exists app_sync_logs_kind_created_at_idx
  on public.app_sync_logs (sync_kind, created_at desc);

-- Пользователи личного кабинета (логин/телефон + пароль).
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  login text not null,
  phone text not null,
  password_hash text not null,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_login_unique unique (login),
  constraint app_users_phone_unique unique (phone)
);

create index if not exists app_users_login_idx on public.app_users (login);
create index if not exists app_users_phone_idx on public.app_users (phone);

alter table public.app_users enable row level security;

alter table public.app_users
  add column if not exists email_verified_at timestamptz;

create table if not exists public.app_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null,
  email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists app_email_verification_tokens_user_id_idx
  on public.app_email_verification_tokens (user_id);

create index if not exists app_email_verification_tokens_token_hash_idx
  on public.app_email_verification_tokens (token_hash);
