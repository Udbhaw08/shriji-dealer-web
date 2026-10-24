-- 011_dealer_registration_flows.sql — temporary verification flows for guest dealer registration
-- Persists short-lived challenge/verification metadata without creating permanent user or dealer records.

create table if not exists dealer_registration_flows (
  id uuid primary key default gen_random_uuid(),
  phone text,
  phone_otp_hash text,
  phone_otp_expires_at timestamptz,
  phone_attempts int not null default 0,
  phone_verified bool not null default false,
  phone_verified_at timestamptz,
  email text,
  email_otp_hash text,
  email_otp_expires_at timestamptz,
  email_attempts int not null default 0,
  email_verified bool not null default false,
  email_verified_at timestamptz,
  verification_token text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dealer_reg_flows_phone_idx on dealer_registration_flows(phone);
create index if not exists dealer_reg_flows_email_idx on dealer_registration_flows(email);
create index if not exists dealer_reg_flows_token_idx on dealer_registration_flows(verification_token);
create index if not exists dealer_reg_flows_expires_idx on dealer_registration_flows(expires_at);
