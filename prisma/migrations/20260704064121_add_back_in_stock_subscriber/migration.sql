-- CreateTable
CREATE TABLE "BackInStockSubscriber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL DEFAULT '',
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "BackInStockSubscriber_shop_productId_idx" ON "BackInStockSubscriber"("shop", "productId");

-- CreateIndex
CREATE INDEX "BackInStockSubscriber_shop_notified_idx" ON "BackInStockSubscriber"("shop", "notified");

-- CreateIndex
CREATE UNIQUE INDEX "BackInStockSubscriber_shop_email_variantId_key" ON "BackInStockSubscriber"("shop", "email", "variantId");
