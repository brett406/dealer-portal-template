-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('CAD', 'USD');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'CAD';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'CAD';

-- AlterTable
ALTER TABLE "ProductUOM" ADD COLUMN     "priceOverrideUsd" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "baseRetailPriceUsd" DECIMAL(10,2);
