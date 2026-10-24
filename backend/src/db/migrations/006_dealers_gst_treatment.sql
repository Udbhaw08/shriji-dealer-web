-- 006_dealers_gst_treatment.sql — Add GST Treatment to dealers table
alter table dealers add column if not exists gst_treatment text;
