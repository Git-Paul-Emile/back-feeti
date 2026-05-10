-- CreateTable
CREATE TABLE "LeisureCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeisureCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeisureItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "priceRange" TEXT,
    "openingHours" TEXT,
    "image" TEXT NOT NULL DEFAULT '',
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "features" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'published',
    "countryCode" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeisureItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeisureFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leisureItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeisureFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeisureCategory_name_key" ON "LeisureCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeisureCategory_slug_key" ON "LeisureCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LeisureFavorite_userId_leisureItemId_key" ON "LeisureFavorite"("userId", "leisureItemId");

-- AddForeignKey
ALTER TABLE "LeisureItem" ADD CONSTRAINT "LeisureItem_categorySlug_fkey" FOREIGN KEY ("categorySlug") REFERENCES "LeisureCategory"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeisureItem" ADD CONSTRAINT "LeisureItem_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeisureItem" ADD CONSTRAINT "LeisureItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeisureFavorite" ADD CONSTRAINT "LeisureFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeisureFavorite" ADD CONSTRAINT "LeisureFavorite_leisureItemId_fkey" FOREIGN KEY ("leisureItemId") REFERENCES "LeisureItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
