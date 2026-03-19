-- CreateTable
CREATE TABLE "ProductAccessory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAccessory_productId_accessoryId_key" ON "ProductAccessory"("productId", "accessoryId");

-- CreateIndex
CREATE INDEX "ProductAccessory_productId_sortOrder_idx" ON "ProductAccessory"("productId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProductAccessory" ADD CONSTRAINT "ProductAccessory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAccessory" ADD CONSTRAINT "ProductAccessory_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
