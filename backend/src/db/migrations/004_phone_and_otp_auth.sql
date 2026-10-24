-- 004_phone_and_otp_auth.sql — support phone-only signup and OTP for new signups

-- 1. Allow email and password_hash to be optional (for phone/OTP/OAuth users)
alter table users alter column email drop not null;
alter table users alter column password_hash drop not null;

-- 2. Fast lookup index on phone
create index if not exists users_phone_idx on users(phone);

-- 3. Add identifier to otp_codes so OTP works for new signups before user record exists
alter table otp_codes add column if not exists identifier text;
create index if not exists otp_codes_identifier_idx on otp_codes(identifier);
