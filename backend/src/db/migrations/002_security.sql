-- 002_security.sql — lock the Supabase REST API door.
-- The backend connects directly as the table owner (postgres), which bypasses
-- RLS, so enabling RLS with NO policies blocks anonymous PostgREST access
-- while leaving every backend query untouched. See docs/BACKEND-ARCHITECTURE.md.

alter table public.users          enable row level security;
alter table public.dealers        enable row level security;
alter table public.staff_invites  enable row level security;
alter table public.refresh_tokens enable row level security;
alter table public.otp_codes      enable row level security;
alter table public.audit_log      enable row level security;
alter table public.webhook_events enable row level security;
alter table public.catalog_cache  enable row level security;
alter table public.sync_state     enable row level security;

-- Security advisor also flagged unindexed foreign keys
create index if not exists dealers_owner_user_idx on dealers(owner_user_id);
create index if not exists otp_codes_user_idx on otp_codes(user_id);
create index if not exists staff_invites_used_by_idx on staff_invites(used_by);
