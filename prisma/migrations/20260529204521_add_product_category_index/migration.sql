-- Index the Product -> ProductCategory foreign key.
-- Postgres does not auto-index foreign keys. The public category catalog
-- (/products/[categorySlug]) and admin product filters query Product by
-- categoryId on most page loads; this covers that join/filter path. Name follows
-- Prisma's "<Model>_<column>_idx" convention so the schema @@index matches with
-- no drift.
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
