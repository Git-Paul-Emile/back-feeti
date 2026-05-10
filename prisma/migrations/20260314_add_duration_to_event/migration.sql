-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "duration" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "salesBlocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserFavorite_userId_eventId_key" ON "UserFavorite"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "UserFavorite" DROP CONSTRAINT IF EXISTS "UserFavorite_userId_fkey";
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFavorite" DROP CONSTRAINT IF EXISTS "UserFavorite_eventId_fkey";
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
