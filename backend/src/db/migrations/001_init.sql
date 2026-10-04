-- 001_init.sql — Shriji backend schema (docs/BACKEND-ARCHITECTURE.md §5.1)

create table if not exists dealers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  business_name text not null,
  gst_number text,
  address text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','revoked')),
  reject_reason text,
  price_tier text,
  dealer_code text unique,
  zoho_account_id text unique,
  staff_limit int not null default 5,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  phone text,
  password_hash text not null,
  role text not null default 'customer'
    check (role in ('customer','dealer','dealer_staff')),
  status text not null default 'pending'
    check (status in ('pending','active','rejected','revoked')),
  dealer_id uuid references dealers(id),
  email_verified bool not null default false,
  zoho_contact_id text,
  created_at timestamptz not null default now()
);

-- circular FK (dealers.owner_user_id ↔ users.dealer_id): drop+add keeps the
-- migration idempotent when it re-runs on an already-migrated database
alter table dealers
  drop constraint if exists dealers_owner_user_fk;
alter table dealers
  add constraint dealers_owner_user_fk
  foreign key (owner_user_id) references users(id);

create index if not exists users_dealer_idx on users(dealer_id);
create index if not exists dealers_status_idx on dealers(status);

create table if not exists staff_invites (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id),
  code_hash text not null,
  expires_at timestamptz not null,
  used_by uuid references users(id),
  used_at timestamptz,
  revoked bool not null default false,
  created_at timestamptz not null default now()
);

create index if not exists staff_invites_dealer_idx on staff_invites(dealer_id);

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  token_hash text not null,
  expires_at timestamptz not null,
  revoked bool not null default false,
  created_at timestamptz not null default now()
);

create index if not exists refresh_tokens_user_idx on refresh_tokens(user_id);

create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  ref_id text,
  payload_hash text not null,
  processed_at timestamptz not null default now()
);

create index if not exists webhook_events_hash_idx on webhook_events(source, payload_hash);

create table if not exists catalog_cache (
  key text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists sync_state (
  key text primary key,
  value text not null
);
