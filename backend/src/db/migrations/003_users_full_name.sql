-- 003_users_full_name.sql — staff/owner display name (mockup: "Your details")
alter table users add column if not exists full_name text;
