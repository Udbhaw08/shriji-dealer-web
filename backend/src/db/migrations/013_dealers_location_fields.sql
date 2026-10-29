-- 013_dealers_location_fields.sql — add real location columns (city, state, pincode) to dealers
alter table dealers add column if not exists city text;
alter table dealers add column if not exists state text;
alter table dealers add column if not exists pincode text;

