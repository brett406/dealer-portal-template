-- AlterTable: ProductCategory — add tags array for industry / cross-cutting filters.
-- Pairs with the existing Product.tags column.
ALTER TABLE "ProductCategory" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
