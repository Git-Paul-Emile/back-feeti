-- Create creator tables
-- Système Créateur / Influenceur

-- Creator profiles
CREATE TABLE IF NOT EXISTS "Creator" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE,
  "bio" TEXT,
  "niche" TEXT,
  "audienceSize" INTEGER DEFAULT 0,
  "engagementRate" REAL DEFAULT 0,
  "rating" REAL DEFAULT 0,
  "reviewCount" INTEGER DEFAULT 0,
  "socialLinks" JSONB DEFAULT '{}'::jsonb,
  "portfolio" TEXT,
  "isVerified" BOOLEAN DEFAULT false,
  "isActive" BOOLEAN DEFAULT true,
  "collaborationCount" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Creator_isActive_idx" ON "Creator"("isActive");
CREATE INDEX IF NOT EXISTS "Creator_niche_idx" ON "Creator"("niche");
CREATE INDEX IF NOT EXISTS "Creator_isVerified_idx" ON "Creator"("isVerified");
CREATE INDEX IF NOT EXISTS "Creator_userId_idx" ON "Creator"("userId");

-- Campaigns
CREATE TABLE IF NOT EXISTS "CreatorCampaign" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "organizerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "budget" INTEGER NOT NULL,
  "currency" TEXT DEFAULT 'FCFA',
  "niche" TEXT,
  "minAudience" INTEGER,
  "requirements" TEXT,
  "deliverables" TEXT,
  "startDate" TEXT,
  "endDate" TEXT NOT NULL,
  "status" TEXT DEFAULT 'open',
  "selectedCount" INTEGER DEFAULT 0,
  "maxCreators" INTEGER DEFAULT 10,
  "rating" REAL DEFAULT 0,
  "reviewCount" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "CreatorCampaign_organizerId_idx" ON "CreatorCampaign"("organizerId");
CREATE INDEX IF NOT EXISTS "CreatorCampaign_status_idx" ON "CreatorCampaign"("status");
CREATE INDEX IF NOT EXISTS "CreatorCampaign_createdAt_idx" ON "CreatorCampaign"("createdAt");

-- Applications
CREATE TABLE IF NOT EXISTS "CreatorCampaignApplication" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "campaignId" TEXT NOT NULL REFERENCES "CreatorCampaign"("id") ON DELETE CASCADE,
  "creatorId" TEXT NOT NULL REFERENCES "Creator"("id") ON DELETE CASCADE,
  "message" TEXT,
  "status" TEXT DEFAULT 'pending',
  "reviewedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now(),
  UNIQUE("campaignId", "creatorId")
);

CREATE INDEX IF NOT EXISTS "CreatorCampaignApplication_campaignId_idx" ON "CreatorCampaignApplication"("campaignId");
CREATE INDEX IF NOT EXISTS "CreatorCampaignApplication_creatorId_idx" ON "CreatorCampaignApplication"("creatorId");
CREATE INDEX IF NOT EXISTS "CreatorCampaignApplication_status_idx" ON "CreatorCampaignApplication"("status");

-- Collaborations
CREATE TABLE IF NOT EXISTS "CreatorCollaboration" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "campaignId" TEXT NOT NULL REFERENCES "CreatorCampaign"("id") ON DELETE CASCADE,
  "creatorId" TEXT NOT NULL REFERENCES "Creator"("id") ON DELETE CASCADE,
  "organizerId" TEXT NOT NULL REFERENCES "User"("id"),
  "agreedFee" INTEGER NOT NULL,
  "currency" TEXT DEFAULT 'FCFA',
  "deliverables" TEXT,
  "status" TEXT DEFAULT 'negotiating',
  "rating" REAL,
  "review" TEXT,
  "paidAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "CreatorCollaboration_campaignId_idx" ON "CreatorCollaboration"("campaignId");
CREATE INDEX IF NOT EXISTS "CreatorCollaboration_creatorId_idx" ON "CreatorCollaboration"("creatorId");
CREATE INDEX IF NOT EXISTS "CreatorCollaboration_organizerId_idx" ON "CreatorCollaboration"("organizerId");
CREATE INDEX IF NOT EXISTS "CreatorCollaboration_status_idx" ON "CreatorCollaboration"("status");
