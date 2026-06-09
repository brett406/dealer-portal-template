-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('raw', 'subassembly');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "laborMarginPercent" DECIMAL(5,2),
ADD COLUMN     "materialMarginPercent" DECIMAL(5,2),
ADD COLUMN     "priceFromBom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "computedCost" DECIMAL(12,4),
ADD COLUMN     "laborMarginPercent" DECIMAL(5,2),
ADD COLUMN     "materialMarginPercent" DECIMAL(5,2),
ADD COLUMN     "priceFromBom" BOOLEAN;

-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "bomCostingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultLaborMarginPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "defaultMaterialMarginPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "kind" "MaterialKind" NOT NULL DEFAULT 'raw',
    "unitCost" DECIMAL(12,4),
    "computedCost" DECIMAL(12,4),
    "categoryId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomComponent" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productVariantId" TEXT,
    "parentMaterialId" TEXT,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePerHour" DECIMAL(10,2) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLaborLine" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productVariantId" TEXT,
    "parentMaterialId" TEXT,
    "laborRateId" TEXT NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomLaborLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Material_sku_key" ON "Material"("sku");

-- CreateIndex
CREATE INDEX "Material_kind_archivedAt_idx" ON "Material"("kind", "archivedAt");

-- CreateIndex
CREATE INDEX "Material_categoryId_idx" ON "Material"("categoryId");

-- CreateIndex
CREATE INDEX "BomComponent_productId_idx" ON "BomComponent"("productId");

-- CreateIndex
CREATE INDEX "BomComponent_productVariantId_idx" ON "BomComponent"("productVariantId");

-- CreateIndex
CREATE INDEX "BomComponent_parentMaterialId_idx" ON "BomComponent"("parentMaterialId");

-- CreateIndex
CREATE INDEX "BomComponent_materialId_idx" ON "BomComponent"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "LaborRate_name_key" ON "LaborRate"("name");

-- CreateIndex
CREATE INDEX "BomLaborLine_productId_idx" ON "BomLaborLine"("productId");

-- CreateIndex
CREATE INDEX "BomLaborLine_productVariantId_idx" ON "BomLaborLine"("productVariantId");

-- CreateIndex
CREATE INDEX "BomLaborLine_parentMaterialId_idx" ON "BomLaborLine"("parentMaterialId");

-- CreateIndex
CREATE INDEX "BomLaborLine_laborRateId_idx" ON "BomLaborLine"("laborRateId");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_parentMaterialId_fkey" FOREIGN KEY ("parentMaterialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLaborLine" ADD CONSTRAINT "BomLaborLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLaborLine" ADD CONSTRAINT "BomLaborLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLaborLine" ADD CONSTRAINT "BomLaborLine_parentMaterialId_fkey" FOREIGN KEY ("parentMaterialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLaborLine" ADD CONSTRAINT "BomLaborLine_laborRateId_fkey" FOREIGN KEY ("laborRateId") REFERENCES "LaborRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Polymorphic-parent integrity (docs/BOM-COSTING.md §3.1): exactly ONE of
-- productId / productVariantId / parentMaterialId must be set per row.
ALTER TABLE "BomComponent" ADD CONSTRAINT bom_component_one_parent
  CHECK (num_nonnulls("productId", "productVariantId", "parentMaterialId") = 1);

ALTER TABLE "BomLaborLine" ADD CONSTRAINT bom_labor_line_one_parent
  CHECK (num_nonnulls("productId", "productVariantId", "parentMaterialId") = 1);
