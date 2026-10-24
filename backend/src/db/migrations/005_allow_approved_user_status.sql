-- 005_allow_approved_user_status.sql
-- Allow status = 'approved' and 'hold' on users table in addition to pending, active, rejected, revoked
alter table users drop constraint if exists users_status_check;
alter table users add constraint users_status_check check (status in ('pending', 'active', 'approved', 'rejected', 'revoked', 'hold'));
