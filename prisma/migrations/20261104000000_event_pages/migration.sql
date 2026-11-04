-- CreateEnum
CREATE TYPE "EventPageStatus" AS ENUM ('draft', 'published', 'paused', 'archived');

-- CreateTable
CREATE TABLE "event_pages" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "slug" TEXT NOT NULL,
    "status" "EventPageStatus" NOT NULL DEFAULT 'draft',
    "theme" JSONB,
    "heroImageUrl" TEXT,
    "gallery" JSONB,
    "sections" JSONB,
    "ctaLabel" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageUrl" TEXT,
    "showOnMainSite" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_page_slug_history" (
    "id" TEXT NOT NULL,
    "slugOld" TEXT NOT NULL,
    "eventPageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_page_slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_pages_eventId_key" ON "event_pages"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_pages_slug_key" ON "event_pages"("slug");

-- CreateIndex
CREATE INDEX "event_pages_status_idx" ON "event_pages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "event_page_slug_history_slugOld_key" ON "event_page_slug_history"("slugOld");

-- CreateIndex
CREATE INDEX "event_page_slug_history_eventPageId_idx" ON "event_page_slug_history"("eventPageId");

-- AddForeignKey
ALTER TABLE "event_pages" ADD CONSTRAINT "event_pages_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_page_slug_history" ADD CONSTRAINT "event_page_slug_history_eventPageId_fkey" FOREIGN KEY ("eventPageId") REFERENCES "event_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

