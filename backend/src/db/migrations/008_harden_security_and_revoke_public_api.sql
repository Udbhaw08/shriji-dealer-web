-- 008_harden_security_and_revoke_public_api.sql
-- Enforce complete lockdown of public schema for Supabase Security Advisor compliance.
-- Ensures RLS is enabled and forced on all tables, and revokes all table/sequence/routine access
-- from public PostgREST API roles (anon and authenticated).

-- 1. Ensure RLS is enabled and forced across all tables in public schema
alter table public.users enable row level security;
alter table public.users force row level security;

alter table public.dealers enable row level security;
alter table public.dealers force row level security;

alter table public.staff_invites enable row level security;
alter table public.staff_invites force row level security;

alter table public.refresh_tokens enable row level security;
alter table public.refresh_tokens force row level security;

alter table public.otp_codes enable row level security;
alter table public.otp_codes force row level security;

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

alter table public.webhook_events enable row level security;
alter table public.webhook_events force row level security;

alter table public.catalog_cache enable row level security;
alter table public.catalog_cache force row level security;

alter table public.sync_state enable row level security;
alter table public.sync_state force row level security;

-- 2. Revoke all privileges from public API roles (anon, authenticated)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all routines in schema public from anon, authenticated;

-- 3. Prevent automatic privilege grants on any newly created tables/sequences in public
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on routines from anon, authenticated;
