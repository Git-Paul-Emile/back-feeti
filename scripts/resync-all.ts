import 'dotenv/config';
import { firestoreSyncService } from './src/services/firestore-sync.service.js';
import { connectToDatabase, prisma } from './src/config/database.js';

function getCollectionName(modelName: string): string {
  const camel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  if (camel.endsWith('y')) return camel.slice(0, -1) + 'ies';
  return camel + 's';
}

async function resyncData() {
  try {
    await connectToDatabase();
    console.log("Démarrage de la resynchronisation de toutes les entités...");
    
    const models = [
      "User", "UserFavorite", "Event", "LiveEventConsentRequest", "FeaturedRequest", 
      "Category", "Country", "DeliveryZone", "City", "DealCategory", "Deal", 
      "LeisureCategory", "LeisureItem", "LeisureFavorite", "Ticket", "DeliveryAddress", 
      "EventController", "BlogCategory", "BlogPost", "Transaction", "TransactionStatusHistory", 
      "Wallet", "WalletLedger", "Payout", "PayoutTransaction", "PayoutStatusHistory", 
      "AuditLog", "IdempotencyKey", "PlatformSetting", "LoyaltyProfile", "PointsLedger", 
      "LoyaltyReward", "LoyaltyRedemption", "LoyaltyMission", "MissionProgress", 
      "LoyaltyPartner", "DailyShareRecord", "PartnerSpending", "CommunityPost", 
      "CommunityEngagement", "AmbassadorBadge", "LoyaltyBonus", "EventZone", 
      "ParticipantCategory", "ZoneAccessRight", "AccessBadge", "AccessLog", 
      "SuspectBadgeReport", "VipAccessLog"
    ];
    
    console.log(`📌 ${models.length} modèles trouvés à synchroniser.`);
    
    for (const modelName of models) {
      console.log(`\n🔄 Starting full resync: ${modelName}`);
      const collectionName = getCollectionName(modelName);
      
      try {
        // Accès dynamique à prisma[modelName]
        const delegate = (prisma as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
        if (!delegate || !delegate.findMany) {
          console.log(`⚠️ Impossible de lire les données pour ${modelName}`);
          continue;
        }

        // On prend tous les enregistrements (attention, si la table est gigantesque il faudrait paginer)
        // Pour une resynchronisation initiale sur une base pas trop énorme, ça passe.
        const records = await delegate.findMany();
        console.log(`Trouvé ${records.length} enregistrements pour ${modelName}`);
        
        let successCount = 0;
        for (const record of records) {
          if (record.id) {
            await firestoreSyncService.syncGeneric(collectionName, record.id, record);
            successCount++;
          }
        }
        console.log(`✅ ${successCount} documents synchronisés pour ${collectionName}`);
      } catch (err) {
        console.error(`❌ Erreur lors de la synchronisation du modèle ${modelName}:`, err);
      }
    }

    console.log("\n🚀 Resynchronisation totale terminée avec succès !");
  } catch (error) {
    console.error("Erreur durant la resynchronisation:", error);
  }
  process.exit(0);
}

resyncData();
