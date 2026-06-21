-- Bid outcome tracking fields
alter table tenders
  add column if not exists outcome_reason text,
  add column if not exists competitor_name text,
  add column if not exists competitor_price numeric,
  add column if not exists post_bid_notes text,
  add column if not exists post_bid_analysis text;
