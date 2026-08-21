-- ============================================================
-- Regroove — Clean up all demo / fake data
-- ============================================================
-- Run this in the Supabase SQL editor. It safely skips any
-- tables that haven't been created yet (older schemas).
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'research_history',
    'ebay_tokens',
    'inventory_events',
    'marketplace_listings',
    'inventory_photos',
    'sales',
    'expenses',
    'tasks',
    'app_settings',
    'marketplace_connections',
    'inventory_items',
    'users'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = t) THEN
      EXECUTE format('DELETE FROM %I', t);
      RAISE NOTICE 'Deleted from %', t;
    ELSE
      RAISE NOTICE 'Skipped % (does not exist)', t;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- Verify: show row counts
-- ============================================================
SELECT 'users'                     AS tbl, count(*) AS rows FROM users
UNION ALL SELECT 'inventory_items',       count(*) FROM inventory_items
UNION ALL SELECT 'marketplace_listings',  count(*) FROM marketplace_listings
UNION ALL SELECT 'inventory_events',      count(*) FROM inventory_events
UNION ALL SELECT 'inventory_photos',      count(*) FROM inventory_photos
UNION ALL SELECT 'sales',                 count(*) FROM sales
UNION ALL SELECT 'expenses',              count(*) FROM expenses
UNION ALL SELECT 'tasks',                 count(*) FROM tasks
UNION ALL SELECT 'app_settings',          count(*) FROM app_settings
UNION ALL SELECT 'marketplace_connections', count(*) FROM marketplace_connections
UNION ALL SELECT 'marketplaces',          count(*) FROM marketplaces
ORDER BY tbl;
