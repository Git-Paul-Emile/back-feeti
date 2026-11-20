UPDATE "LoyaltyProfile"
SET "level" = CASE
  WHEN "points" >= 10000 THEN 'Boboto'::"LoyaltyLevel"
  WHEN "points" >= 5000 THEN 'Mwana'::"LoyaltyLevel"
  WHEN "points" >= 2000 THEN 'Momi'::"LoyaltyLevel"
  WHEN "points" >= 500 THEN 'Elengi'::"LoyaltyLevel"
  ELSE 'Mobembo'::"LoyaltyLevel"
END
WHERE "level" IS DISTINCT FROM CASE
  WHEN "points" >= 10000 THEN 'Boboto'::"LoyaltyLevel"
  WHEN "points" >= 5000 THEN 'Mwana'::"LoyaltyLevel"
  WHEN "points" >= 2000 THEN 'Momi'::"LoyaltyLevel"
  WHEN "points" >= 500 THEN 'Elengi'::"LoyaltyLevel"
  ELSE 'Mobembo'::"LoyaltyLevel"
END;
