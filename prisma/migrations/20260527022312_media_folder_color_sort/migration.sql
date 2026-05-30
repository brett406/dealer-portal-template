-- AlterTable
ALTER TABLE "AssetFolder" ADD COLUMN     "accentColor" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
