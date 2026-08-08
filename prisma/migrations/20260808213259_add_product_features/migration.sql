-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
