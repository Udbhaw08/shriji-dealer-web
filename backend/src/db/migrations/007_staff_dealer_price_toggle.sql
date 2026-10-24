-- 007_staff_dealer_price_toggle.sql — Allow dealers to toggle dealer wholesale price visibility for staff users
alter table users
  add column if not exists can_see_dealer_price boolean not null default true;

alter table dealers
  add column if not exists hide_staff_dealer_price boolean not null default false;
