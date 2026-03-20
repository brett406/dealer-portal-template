-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_name_key" ON "TaxRate"("name");

-- AlterTable: Add taxRateId to Company
ALTER TABLE "Company" ADD COLUMN "taxRateId" TEXT;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add tax fields to Order
ALTER TABLE "Order" ADD COLUMN "taxRateSnapshot" TEXT;
ALTER TABLE "Order" ADD COLUMN "taxPercentSnapshot" DECIMAL(5,2);
ALTER TABLE "Order" ADD COLUMN "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Seed Canadian tax rates
INSERT INTO "TaxRate" ("id", "name", "label", "percent", "description", "sortOrder", "active", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Alberta', 'AB - GST 5%', 5.00, '5% GST', 0, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'British Columbia', 'BC - GST+PST 12%', 12.00, '5% GST + 7% PST', 1, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Manitoba', 'MB - GST+PST 12%', 12.00, '5% GST + 7% PST', 2, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'New Brunswick', 'NB - HST 15%', 15.00, '15% HST', 3, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Newfoundland and Labrador', 'NL - HST 15%', 15.00, '15% HST', 4, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Northwest Territories', 'NT - GST 5%', 5.00, '5% GST', 5, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Nova Scotia', 'NS - HST 15%', 15.00, '15% HST', 6, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Nunavut', 'NU - GST 5%', 5.00, '5% GST', 7, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Ontario', 'ON - HST 13%', 13.00, '13% HST', 8, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Prince Edward Island', 'PE - HST 15%', 15.00, '15% HST', 9, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Quebec', 'QC - GST+QST 14.975%', 14.975, '5% GST + 9.975% QST', 10, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Saskatchewan', 'SK - GST+PST 11%', 11.00, '5% GST + 6% PST', 11, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Yukon', 'YT - GST 5%', 5.00, '5% GST', 12, true, NOW(), NOW());
