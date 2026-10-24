-- 010_phone_verified_and_onboarding.sql
-- Add phone_verified to public.users and safely backfill only accounts with confirmed OTP history or approved dealer status.

alter table public.users
  add column if not exists phone_verified boolean not null default false;

create index if not exists users_phone_verified_idx on public.users(phone, phone_verified);

-- Safe backfill: Only verify accounts that have confirmed OTP audit events in audit_log
update public.users set phone_verified = true
where phone is not null
  and id in (
    select distinct actor_id from public.audit_log
    where action in ('auth.otp_signup', 'auth.otp_verified')
      and actor_id is not null
  );

-- Safe backfill: Also verify owners of approved, CRM-linked dealers
update public.users set phone_verified = true
where phone is not null
  and id in (
    select owner_user_id from public.dealers
    where status = 'approved'
      and zoho_account_id is not null
      and owner_user_id is not null
  );
