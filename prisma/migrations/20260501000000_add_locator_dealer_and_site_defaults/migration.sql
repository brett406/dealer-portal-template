-- AlterTable: Address — default country was "US"; switch to "CA" since the template's
-- typical use-case is Canadian (existing rows are unchanged because we're only
-- moving the column DEFAULT, not the data).
ALTER TABLE "Address" ALTER COLUMN "country" SET DEFAULT 'CA';

-- AlterTable: SiteSetting — add country + map defaults
ALTER TABLE "SiteSetting" ADD COLUMN "defaultCountry" TEXT NOT NULL DEFAULT 'CA';
ALTER TABLE "SiteSetting" ADD COLUMN "defaultMapCenterLat" DECIMAL(10,6);
ALTER TABLE "SiteSetting" ADD COLUMN "defaultMapCenterLng" DECIMAL(10,6);
ALTER TABLE "SiteSetting" ADD COLUMN "defaultMapZoom" INTEGER NOT NULL DEFAULT 4;

-- CreateTable: LocatorDealer
CREATE TABLE "LocatorDealer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "dealerType" TEXT,
    "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "latitude" DECIMAL(10,6),
    "longitude" DECIMAL(10,6),
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocatorDealer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LocatorDealer_slug_key" ON "LocatorDealer"("slug");
CREATE INDEX "LocatorDealer_active_region_sortOrder_idx" ON "LocatorDealer"("active", "region", "sortOrder");
CREATE INDEX "LocatorDealer_active_dealerType_idx" ON "LocatorDealer"("active", "dealerType");
