-- ============================================================
-- Ventage — Phase 2 demo seed (development only)
-- Run AFTER schema.sql. Uses relative dates (NOW() - N days)
-- so the demo always looks current, no matter when it's run.
--
-- WARNING: This truncates the Ventage data tables. Run only on
-- a fresh database or when you want to reset to demo data.
--
-- NOTE: All rows here are owner-less (owner_id = NULL), so RLS
-- hides them from signed-in users. They exist so local dev and
-- the SQL editor show populated tables. Real users get their
-- own data through the in-app onboarding ("Start with Demo
-- Data"), which inserts rows owned by that user.
-- ============================================================

truncate table
  inventory_events,
  marketplace_listings,
  inventory_photos,
  sales,
  expenses,
  tasks,
  marketplace_connections,
  inventory_items,
  app_settings
cascade;

-- ------------------------------------------------------------
-- marketplaces (static reference)
-- ------------------------------------------------------------
insert into marketplaces (id, name, tagline, integration, sort_order) values
  ('ebay',     'eBay',                'Your biggest channel — synced automatically.', 'official', 1),
  ('depop',    'Depop',               'Core reseller channel, tracked manually for now.', 'manual', 2),
  ('poshmark', 'Poshmark',            'Great for bundles and higher-priced pieces.', 'manual', 3),
  ('vinted',   'Vinted',              'Fast turnaround on basics and tees.', 'manual', 4),
  ('mercari',  'Mercari',             'Not connected yet — add when you start selling there.', 'manual', 5),
  ('facebook', 'Facebook Marketplace', 'Great for local pickup on larger items.', 'manual', 6)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- marketplace_connections (per-shop connection state)
-- ------------------------------------------------------------
insert into marketplace_connections
  (owner_id, marketplace_id, status, account, sync_type, note, last_sync) values
  (null, 'ebay',     'connected',     'grayson.resells',     'auto',   'Listings, sales, and fees pull in automatically once integration is live.', now() - interval '3 hours'),
  (null, 'depop',    'connected',     '@grayson.thrift',     'manual', 'Listings are tracked manually until the Depop integration ships.',          now() - interval '1 day'),
  (null, 'poshmark', 'connected',     '@grayson.vintage',    'manual', 'Offers and bundles are noted in item history manually.',                     now() - interval '2 days'),
  (null, 'vinted',   'manual',        '@vintage.grayson',    'manual', 'Connected for tracking — prices and listings stay in sync by hand.',          now() - interval '3 days'),
  (null, 'mercari',  'not-connected', null,                  'manual', 'No Mercari account connected. You can still track sales manually.',            null),
  (null, 'facebook', 'manual',        'Grayson''s Vintage Finds', 'manual', 'Local listings tracked manually.',                                      now() - interval '4 days')
on conflict (owner_id, marketplace_id) do nothing;

-- ------------------------------------------------------------
-- inventory_items
-- ------------------------------------------------------------
insert into inventory_items
  (sku, name, brand, category, size, era, condition, purchase_price, listing_price, status,
   acquired_date, listed_date, notes, tags) values
  -- Hand-curated hero items
  ('VN-1000', 'Vintage Levi''s Trucker Jacket', 'Levi''s', 'Jackets & Coats', 'M', '90s', 'Very good — one small mark', 28, 95, 'listed',
   current_date - 46, current_date - 31,
   array['Classic ''90s trucker in the washed-black fade. Tags intact.', 'Small mark on left cuff — disclosed in listing.'],
   array['90s', 'vintage', 'workwear']),
  ('VN-1001', 'Carhartt Detroit Work Jacket', 'Carhartt', 'Jackets & Coats', 'L', '90s', 'Excellent', 45, 160, 'listed',
   current_date - 21, current_date - 9,
   array['Duck shell with blanket lining — the grail cut.', 'Stored in garment bag; hardware all original.'],
   array['90s', 'vintage', 'grail']),
  ('VN-1002', '''90s Nike Club Fleece Hoodie', 'Nike', 'Hoodies & Sweats', 'M', '90s', 'Good — faded wash', 18, 75, 'listed',
   current_date - 38, current_date - 25,
   array['Heavyweight fleece, perfect faded ''90s wash.'],
   array['90s', 'vintage', 'streetwear']),
  ('VN-1003', 'Harley-Davidson Motor Tee', 'Harley-Davidson', 'Tops & Tees', 'L', '80s', 'Excellent — crisp print', 12, 48, 'listed',
   current_date - 52, current_date - 40,
   array['Single-stitch 80s tee, bold chest print, no cracking.'],
   array['80s', 'vintage', 'streetwear']),
  ('VN-1004', 'Pendleton Wool Flannel', 'Pendleton', 'Flannels & Shirts', 'M', '70s', 'Very good', 22, 85, 'listed',
   current_date - 60, current_date - 48,
   array['Authentic vintage Pendleton in the board shirt plaid.', 'Dry-cleaned and pressed.'],
   array['70s', 'vintage']),
  ('VN-1005', 'Y2K Columbia Titanium Windbreaker', 'Columbia', 'Outerwear', 'M', '2000s', 'Excellent', 15, 65, 'listed',
   current_date - 18, current_date - 6,
   array['Y2K titanium shell — iridescent olive finish.', 'Drawstrings and zips all working.'],
   array['y2k', 'vintage']),
  ('VN-1006', 'Champion Reverse Weave Crewneck', 'Champion', 'Hoodies & Sweats', 'XL', '90s', 'Very good', 25, 90, 'sold',
   current_date - 95, null,
   array['Oversized 90s Reverse Weave, lettering intact.'],
   array['90s', 'vintage']),
  ('VN-1007', 'Levi''s 501 Button-Fly Jeans', 'Levi''s', 'Denim & Pants', '34×32', '80s', 'Good — natural fade', 30, 120, 'listed',
   current_date - 34, current_date - 20,
   array['Great honeycomb fade, all buttons original.', 'Wash: original (no soak).'],
   array['80s', 'vintage', 'denim']),
  ('VN-1008', 'Ralph Lauren Rugby Stripe Polo', 'Ralph Lauren', 'Tops & Tees', 'M', '90s', 'Excellent', 14, 60, 'listed',
   current_date - 27, current_date - 15,
   array['Rugby stripes in great condition, embroidered pony.'],
   array['90s', 'vintage', 'preppy']),
  ('VN-1009', 'Patagonia Retro-X Fleece', 'Patagonia', 'Outerwear', 'M', '90s', 'Excellent', 40, 140, 'draft',
   current_date - 8, null,
   array['Next lot to photograph — heavyweight fleece, full zip.', 'Expect strong demand; limited size run.'],
   array['90s', 'vintage']),
  ('VN-1010', 'Wrangler Corduroy Jacket', 'Wrangler', 'Jackets & Coats', 'L', '70s', 'Very good', 26, 88, 'draft',
   current_date - 11, null,
   array['Earth-tone wale corduroy, western cut.', 'Needs a soak and press before photos.'],
   array['70s', 'vintage', 'workwear']),
  ('VN-1011', 'Tommy Hilfiger Flag Sweater', 'Tommy Hilfiger', 'Knitwear & Sweaters', 'M', '90s', 'Good — slight pilling', 20, 78, 'listed',
   current_date - 29, current_date - 17,
   array['De-pilled and steamed. Flag knit is clean.'],
   array['90s', 'vintage', 'preppy']),
  -- Generated stock (representative subset)
  ('VN-1012', 'Dickies Eisenhower Jacket', 'Dickies', 'Jackets & Coats', 'M', '90s', 'Very good', 24, 82, 'listed',
   current_date - 47, current_date - 33, array['Crisp twill Eisenhower. Clean lining.'], array['90s', 'workwear']),
  ('VN-1013', 'Gap ''90s Washed Tee', 'Gap', 'Tops & Tees', 'M', '90s', 'Good', 8, 34, 'listed',
   current_date - 19, current_date - 7, array['Perfect ''90s boxy cut, soft washed cotton.'], array['90s', 'vintage']),
  ('VN-1014', 'Pendleton Board Shirt', 'Pendleton', 'Flannels & Shirts', 'L', '80s', 'Excellent', 27, 92, 'listed',
   current_date - 55, current_date - 41, array['Bold board plaid, no stains or wear.'], array['80s', 'vintage']),
  ('VN-1015', 'Ben Davis Bib Overalls', 'Ben Davis', 'Denim & Pants', '32×30', '90s', 'Very good', 32, 105, 'listed',
   current_date - 63, current_date - 49, array['Heavy duck bib overalls with original buttons.'], array['90s', 'workwear']),
  ('VN-1016', 'The North Face Denali Fleece', 'The North Face', 'Outerwear', 'L', '90s', 'Very good', 35, 130, 'sold',
   current_date - 46, null, array['Classic Denali with the embroidered logo.'], array['90s', 'vintage', 'streetwear']),
  ('VN-1017', 'New Era Starter Snapback', 'New Era', 'Hats & Accessories', 'OS', '90s', 'Good', 9, 38, 'listed',
   current_date - 24, current_date - 10, array['Starter logo snapback, adjustable.'], array['90s', 'vintage']),
  ('VN-1018', 'Fila Disruptor Tee', 'Fila', 'Tops & Tees', 'XL', '90s', 'Very good', 10, 40, 'listed',
   current_date - 30, current_date - 16, array['Bold Fila box logo, thick cotton.'], array['90s', 'vintage']),
  ('VN-1019', 'Wrangler 13MWZ Jeans', 'Wrangler', 'Denim & Pants', '33×31', '90s', 'Excellent', 19, 68, 'listed',
   current_date - 40, current_date - 26, array['Clean 13MWZ cowboy cut, stiff denim.'], array['90s', 'denim', 'workwear']),
  ('VN-1020', 'Champion Script Hoodie', 'Champion', 'Hoodies & Sweats', 'M', '2000s', 'Very good', 16, 55, 'sold',
   current_date - 41, null, array['Cursive script hoodie, washed-soft.'], array['2000s', 'vintage']),
  ('VN-1021', 'Nike Windrunner (Vintage)', 'Nike', 'Outerwear', 'L', '90s', 'Very good', 26, 89, 'listed',
   current_date - 36, current_date - 22, array['Classic Windrunner with the chevron chest.'], array['90s', 'vintage', 'streetwear'])
on conflict (sku) where deleted_at is null do nothing;

-- ------------------------------------------------------------
-- marketplace_listings — live listings for listed items
-- ------------------------------------------------------------
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 95, 'LST-001-1' from inventory_items where sku = 'VN-1000';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'depop', 'live', 95, 'LST-001-2' from inventory_items where sku = 'VN-1000';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 160, 'LST-002-1' from inventory_items where sku = 'VN-1001';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'depop', 'live', 75, 'LST-003-1' from inventory_items where sku = 'VN-1002';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'vinted', 'live', 75, 'LST-003-2' from inventory_items where sku = 'VN-1002';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 48, 'LST-004-1' from inventory_items where sku = 'VN-1003';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'facebook', 'live', 48, 'LST-004-2' from inventory_items where sku = 'VN-1003';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 85, 'LST-005-1' from inventory_items where sku = 'VN-1004';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'depop', 'live', 85, 'LST-005-2' from inventory_items where sku = 'VN-1004';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'depop', 'live', 65, 'LST-006-1' from inventory_items where sku = 'VN-1005';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'vinted', 'live', 65, 'LST-006-2' from inventory_items where sku = 'VN-1005';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'facebook', 'live', 65, 'LST-006-3' from inventory_items where sku = 'VN-1005';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 120, 'LST-008-1' from inventory_items where sku = 'VN-1007';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'poshmark', 'live', 120, 'LST-008-2' from inventory_items where sku = 'VN-1007';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 60, 'LST-009-1' from inventory_items where sku = 'VN-1008';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'poshmark', 'live', 60, 'LST-009-2' from inventory_items where sku = 'VN-1008';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'facebook', 'live', 60, 'LST-009-3' from inventory_items where sku = 'VN-1008';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'depop', 'live', 78, 'LST-012-1' from inventory_items where sku = 'VN-1011';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'vinted', 'live', 78, 'LST-012-2' from inventory_items where sku = 'VN-1011';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 82, 'LST-013-1' from inventory_items where sku = 'VN-1012';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'depop', 'live', 34, 'LST-014-1' from inventory_items where sku = 'VN-1013';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'vinted', 'live', 34, 'LST-014-2' from inventory_items where sku = 'VN-1013';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 92, 'LST-015-1' from inventory_items where sku = 'VN-1014';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 105, 'LST-016-1' from inventory_items where sku = 'VN-1015';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'poshmark', 'live', 105, 'LST-016-2' from inventory_items where sku = 'VN-1015';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'facebook', 'live', 38, 'LST-018-1' from inventory_items where sku = 'VN-1017';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'depop', 'live', 40, 'LST-019-1' from inventory_items where sku = 'VN-1018';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'ebay', 'live', 68, 'LST-020-1' from inventory_items where sku = 'VN-1019';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'depop', 'live', 89, 'LST-022-1' from inventory_items where sku = 'VN-1021';
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select id, 'vinted', 'live', 89, 'LST-022-2' from inventory_items where sku = 'VN-1021';

-- ------------------------------------------------------------
-- sales
-- ------------------------------------------------------------
-- Sales tied to inventory items (sold status)
insert into sales (item_id, item_name, marketplace_id, sold_date, sold_price, fees, shipping_cost, payout, profit)
select id, 'Champion Reverse Weave Crewneck', 'depop', current_date - 12, 110.00, 11.30, 8.20, 90.50, 65.50
from inventory_items where sku = 'VN-1006';
insert into sales (item_id, item_name, marketplace_id, sold_date, sold_price, fees, shipping_cost, payout, profit)
select id, 'The North Face Denali Fleece', 'ebay', current_date - 26, 145.00, 19.51, 9.40, 116.09, 81.09
from inventory_items where sku = 'VN-1016';
insert into sales (item_id, item_name, marketplace_id, sold_date, sold_price, fees, shipping_cost, payout, profit)
select id, 'Champion Script Hoodie', 'depop', current_date - 18, 62.00, 6.50, 6.10, 49.40, 33.40
from inventory_items where sku = 'VN-1020';

-- Past standalone sales
insert into sales (item_id, item_name, marketplace_id, sold_date, sold_price, fees, shipping_cost, payout, profit) values
  (null, '''90s Starter Pullover', 'ebay', current_date - 61, 84.00, 11.43, 6.50, 66.07, 35.83),
  (null, 'Vintage Levi''s Western Shirt', 'depop', current_date - 68, 58.00, 6.10, 7.20, 44.70, 24.98),
  (null, 'Carhartt Beanies (Bundle of 3)', 'poshmark', current_date - 74, 74.00, 14.80, 9.10, 50.10, 19.02),
  (null, 'Nike ACG Fleece', 'ebay', current_date - 81, 96.00, 13.02, 8.40, 74.58, 42.90),
  (null, 'Wrangler Denim Shirt', 'vinted', current_date - 88, 44.00, 2.20, 5.60, 36.20, 22.56),
  (null, 'Columbia Interchange Jacket', 'ebay', current_date - 95, 88.00, 11.96, 9.80, 66.24, 31.04),
  (null, 'Fila Disruptor Hoodie', 'depop', current_date - 102, 52.00, 5.50, 6.90, 39.60, 21.40),
  (null, 'Vintage Wool Blazer', 'poshmark', current_date - 109, 118.00, 23.60, 10.50, 83.90, 30.80),
  (null, 'Champion Heavyweight Tee', 'vinted', current_date - 116, 38.00, 1.90, 5.20, 30.90, 18.74),
  (null, 'Levi''s 550 Jeans', 'ebay', current_date - 123, 66.00, 9.05, 7.80, 49.15, 24.07),
  (null, 'Gap Fleece Crewneck', 'facebook', current_date - 130, 42.00, 2.10, 6.30, 33.60, 19.74),
  (null, 'Nike Cork Tee', 'depop', current_date - 137, 36.00, 3.90, 5.40, 26.70, 15.54),
  (null, 'Pendleton Wool Vest', 'ebay', current_date - 144, 62.00, 8.52, 6.70, 46.78, 21.98),
  (null, 'Adidas Track Jacket', 'vinted', current_date - 151, 72.00, 3.60, 8.30, 60.10, 32.74),
  (null, 'Tommy Hilfiger Sail Tee', 'depop', current_date - 158, 46.00, 4.90, 5.90, 35.20, 20.02),
  (null, 'Carhartt Duck Bibs', 'ebay', current_date - 165, 92.00, 12.49, 9.60, 69.91, 31.27),
  (null, 'The North Face Base Camp Tee', 'facebook', current_date - 172, 34.00, 1.70, 5.10, 27.20, 17.00),
  (null, 'Vintage Harley Tee (Black)', 'ebay', current_date - 179, 54.00, 7.46, 6.40, 40.14, 21.78),
  -- Recent two weeks
  (null, 'Gap Relaxed Fit Tee', 'depop', current_date - 2, 115.00, 11.80, 7.50, 95.70, 49.70),
  (null, '''80s Champion Sweatshirt', 'vinted', current_date - 5, 51.00, 2.55, 6.00, 42.45, 24.09),
  (null, 'Wrangler Pearl Snap', 'ebay', current_date - 8, 68.00, 9.31, 7.10, 51.59, 29.83),
  (null, 'Y2K Fila Windbreaker', 'vinted', current_date - 3, 37.00, 1.85, 5.30, 29.85, 18.38),
  (null, 'Vintage Nike Training Tee', 'poshmark', current_date - 10, 108.00, 21.60, 8.80, 77.60, 34.40),
  (null, 'Levi''s Sherpa Trucker', 'ebay', current_date - 6, 96.00, 13.02, 9.20, 73.78, 37.30),
  (null, 'Patagonia Synchilla Fleece', 'depop', current_date - 12, 74.00, 7.70, 7.90, 58.40, 28.80),
  (null, 'Carhartt Logo Cap', 'facebook', current_date - 1, 33.00, 1.65, 4.90, 26.45, 16.55),
  (null, 'Columbia Fleece Zip', 'poshmark', current_date - 9, 44.00, 8.80, 6.20, 29.00, 14.92);

-- Sold listings (status 'sold') derived from item sales
insert into marketplace_listings (item_id, marketplace_id, status, price, listing_id)
select s.item_id, s.marketplace_id, 'sold', s.sold_price, 'LST-SOLD-' || s.item_id::text
from sales s where s.item_id is not null;

-- ------------------------------------------------------------
-- expenses
-- ------------------------------------------------------------
insert into expenses (category, description, amount, date) values
  ('Shipping', 'USPS Priority Mail — 4 packages', 32.20, current_date - 1),
  ('Fees', 'eBay final value fees (batch)', 41.85, current_date - 2),
  ('Packaging & Supplies', 'Poly mailers ×50', 11.50, current_date - 3),
  ('Cleaning & Repair', 'Dry cleaning — 2 jackets', 28.00, current_date - 4),
  ('Sourcing', 'Rose Bowl flea market — entry + haul', 85.00, current_date - 6),
  ('Shipping', 'USPS Ground Advantage — 3 packages', 18.60, current_date - 8),
  ('Photography', 'Garment steamer', 34.99, current_date - 10),
  ('Fees', 'Depop payment + listing fees', 22.40, current_date - 11),
  ('Packaging & Supplies', 'Kraft shipping boxes ×25', 21.75, current_date - 13),
  ('Storage', 'Garment rack + hanger pack', 46.00, current_date - 15),
  ('Software & Tools', 'Listing & inventory tool (monthly)', 19.00, current_date - 17),
  ('Shipping', 'UPS label — wool overcoat', 14.85, current_date - 19),
  ('Cleaning & Repair', 'Zipper repair — Levi''s jacket', 18.00, current_date - 21),
  ('Sourcing', 'Estate sale purchases', 112.00, current_date - 24),
  ('Fees', 'Poshmark commission (bundle sale)', 18.60, current_date - 26),
  ('Packaging & Supplies', 'Tissue paper + thank-you cards', 13.20, current_date - 28),
  ('Shipping', 'USPS Priority — 5 packages', 41.40, current_date - 32),
  ('Photography', 'LED photo light kit', 59.99, current_date - 36),
  ('Fees', 'Vinted buyer-protection share', 9.80, current_date - 41),
  ('Sourcing', 'Flea market run — gas + entry', 48.00, current_date - 45),
  ('Cleaning & Repair', 'Vintage wash & press — 6 pcs', 42.00, current_date - 50),
  ('Storage', 'Storage bins ×4', 32.00, current_date - 58),
  ('Packaging & Supplies', 'Shipping tape + labels', 9.25, current_date - 63),
  ('Fees', 'eBay store subscription', 21.95, current_date - 70),
  ('Shipping', 'USPS Ground Advantage — 2 packages', 12.30, current_date - 74),
  ('Sourcing', 'Weekend sourcing trip', 96.00, current_date - 82),
  ('Software & Tools', 'Photo editing app (monthly)', 12.99, current_date - 89),
  ('Cleaning & Repair', 'De-pilling service — sweaters', 16.00, current_date - 96),
  ('Fees', 'Depop payment fees (batch)', 26.70, current_date - 104),
  ('Photography', 'Backdrop + clips', 27.50, current_date - 112),
  ('Packaging & Supplies', 'Bubble mailers ×40', 15.80, current_date - 121),
  ('Sourcing', 'Estate sale purchases', 128.00, current_date - 134);

-- ------------------------------------------------------------
-- tasks
-- ------------------------------------------------------------
insert into tasks (title, due, kind, done) values
  ('Ship 4 orders before the 5 PM cutoff', current_date, 'shipping', false),
  ('Photograph the new Carhartt lot (3 pcs)', current_date + 1, 'photo', false),
  ('Draft listing for Levi''s 501 — add measurements', current_date + 1, 'listing', false),
  ('Repost 5 stale Depop listings', current_date + 2, 'listing', false),
  ('Source run: Saturday flea market', current_date + 4, 'sourcing', false),
  ('Respond to 2 offers on the Harley tee', current_date, 'general', true),
  ('Update shipping profiles for weight changes', current_date + 3, 'general', true);

-- ------------------------------------------------------------
-- inventory_events — timeline derived from item/sale data
-- ------------------------------------------------------------
insert into inventory_events (item_id, kind, title, description, occurred_at)
select id, 'acquired', 'Item acquired', 'Purchased for ' || purchase_price || ' USD.', acquired_date
from inventory_items;

insert into inventory_events (item_id, kind, title, description, occurred_at)
select id, 'listed', 'Listed for sale', 'Listed at ' || listing_price || ' USD.', listed_date
from inventory_items where listed_date is not null;

insert into inventory_events (item_id, kind, title, description, occurred_at)
select s.item_id, 'sold', 'Sold', 'Sold for ' || s.sold_price || ' USD on ' || m.name || '.', s.sold_date
from sales s join marketplaces m on m.id = s.marketplace_id
where s.item_id is not null;

-- ------------------------------------------------------------
-- app_settings — dev settings row (owner-less; per-user rows are
-- created by onboarding or on first save in the app)
-- ------------------------------------------------------------
insert into app_settings (owner_id, profile, shop, notifications) values (null,
  '{"displayName": "Grayson R.", "email": "", "shopName": "Grayson''s Vintage", "phone": ""}'::jsonb,
  '{"currency": "USD", "defaultMarketplace": "ebay", "salesTaxRate": "0", "shippingDefault": "8", "autoCalcProfit": true, "suggestPrice": true}'::jsonb,
  '{"newSales": true, "offers": true, "lowStock": true, "weeklyDigest": false, "listingEnd": true}'::jsonb
) on conflict (owner_id) do nothing;
