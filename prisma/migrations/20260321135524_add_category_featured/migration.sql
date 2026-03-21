-- DropIndex
DROP INDEX "Product_active_category_sort_idx";

-- DropIndex
DROP INDEX "Product_name_trgm_idx";

-- DropIndex
DROP INDEX "ProductCategory_active_sort_idx";

-- DropIndex
DROP INDEX "ProductVariant_product_active_price_idx";

-- DropIndex
DROP INDEX "ProductVariant_sku_trgm_idx";

-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;
