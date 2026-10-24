-- 012_dealer_registration_token_hash.sql
-- Security Hardening Patch for Dealer Registration Flow:
-- 1. Contact-level cooldown tracking (independent of IP, flowId, and session creation).
-- 2. Hashed storage for verification tokens (SHA-256) and removal of legacy plaintext column.

-- ============================================================================
-- 1. Contact-Level OTP Cooldowns
-- ============================================================================
-- Server-enforced cooldown for normalized phone and email recipients to prevent
-- public SMS/WhatsApp/Email flooding and bypass via new flow IDs or rotating IPs.
create table if not exists dealer_otp_cooldowns (
  contact text primary key,
  last_sent_at timestamptz not null default now()
);

create index if not exists dealer_otp_cooldowns_sent_idx on dealer_otp_cooldowns(last_sent_at);

-- ============================================================================
-- 2. Verification Token Hashing & Plaintext Token Elimination
-- ============================================================================
-- Add verification_token_hash column (stores 64-char SHA-256 hex digest).
alter table dealer_registration_flows add column if not exists verification_token_hash text;
create index if not exists dealer_reg_flows_token_hash_idx on dealer_registration_flows(verification_token_hash);

-- Drop legacy plaintext verification_token index and column.
-- NOTE: In-flight temporary registration flows that were holding plaintext tokens
-- are invalidated by dropping this column. This is safe because registration flows
-- have a short 30-minute lifespan and dealers re-request/verify cleanly.
drop index if exists dealer_reg_flows_token_idx;
alter table dealer_registration_flows drop column if exists verification_token;
