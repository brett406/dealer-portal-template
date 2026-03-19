-- Add madeToOrder flag to Product
ALTER TABLE "Product" ADD COLUMN "madeToOrder" BOOLEAN NOT NULL DEFAULT false;
