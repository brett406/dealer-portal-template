-- Full-text search index on Product name and description
CREATE INDEX IF NOT EXISTS "Product_search_idx"
  ON "Product" USING GIN (
    to_tsvector('english', coalesce("name", '') || ' ' || coalesce("description", ''))
  );

-- Index for product listing queries (active + category + sort)
CREATE INDEX IF NOT EXISTS "Product_active_category_sort_idx"
  ON "Product" ("active", "categoryId", "sortOrder", "id");

-- Index for variant price range queries
CREATE INDEX IF NOT EXISTS "ProductVariant_product_active_price_idx"
  ON "ProductVariant" ("productId", "active", "baseRetailPrice");

-- Index for category active + sort queries
CREATE INDEX IF NOT EXISTS "ProductCategory_active_sort_idx"
  ON "ProductCategory" ("active", "sortOrder");

-- Index for price level default lookup
CREATE INDEX IF NOT EXISTS "PriceLevel_default_idx"
  ON "PriceLevel" ("isDefault") WHERE "isDefault" = true;

-- Enable trigram extension for fuzzy search (optional — may not be available on managed Postgres)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm extension not available — skipping trigram indexes';
  RETURN;
END
$$;

-- Trigram indexes (only work if pg_trgm was successfully created above)
CREATE INDEX IF NOT EXISTS "ProductVariant_sku_trgm_idx"
  ON "ProductVariant" USING GIN ("sku" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING GIN ("name" gin_trgm_ops);
