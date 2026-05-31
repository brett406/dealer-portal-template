-- DropIndex (IF EXISTS: these indexes were partially dropped in a failed March
-- 2026 deploy; making the drops idempotent so this migration succeeds whether
-- they exist or not)
DROP INDEX IF EXISTS "Product_active_category_sort_idx";
DROP INDEX IF EXISTS "Product_name_trgm_idx";
DROP INDEX IF EXISTS "ProductCategory_active_sort_idx";
DROP INDEX IF EXISTS "ProductVariant_product_active_price_idx";
DROP INDEX IF EXISTS "ProductVariant_sku_trgm_idx";

-- AlterTable (IF NOT EXISTS: same reason)
ALTER TABLE "ProductCategory" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
