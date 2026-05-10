import { PrismaClient } from "../../src/generated/prisma/client.js";

function getCollectionName(modelName: string): string {
  const camel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  if (camel.endsWith('y')) return camel.slice(0, -1) + 'ies';
  return camel + 's';
}

const basePrisma = new PrismaClient();

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        const result = await query(args);
        if (result && (result as any).id) {
          import('../services/firestore-sync.service.js').then(({ firestoreSyncService }) => {
            firestoreSyncService.syncGeneric(getCollectionName(model), (result as any).id, result).catch(console.error);
          });
        }
        return result;
      },
      async update({ model, args, query }) {
        const result = await query(args);
        if (result && (result as any).id) {
          import('../services/firestore-sync.service.js').then(({ firestoreSyncService }) => {
            firestoreSyncService.syncGeneric(getCollectionName(model), (result as any).id, result).catch(console.error);
          });
        }
        return result;
      },
      async upsert({ model, args, query }) {
        const result = await query(args);
        if (result && (result as any).id) {
          console.log(`[Extension] Upsert capté pour ${model}, lancement synchro...`);
          import('../services/firestore-sync.service.js').then(({ firestoreSyncService }) => {
            firestoreSyncService.syncGeneric(getCollectionName(model), (result as any).id, result)
              .then(() => console.log(`[Extension] Synchro OK pour ${model}/${(result as any).id}`))
              .catch(console.error);
          }).catch(err => console.error("[Extension] Erreur d'import :", err));
        }
        return result;
      },
      async delete({ model, args, query }) {
        const result = await query(args);
        if (result && (result as any).id) {
          import('../services/firestore-sync.service.js').then(({ firestoreSyncService }) => {
            firestoreSyncService.deleteGeneric(getCollectionName(model), (result as any).id).catch(console.error);
          });
        }
        return result;
      }
    }
  }
});

export const connectToDatabase = async () => {
 try {
   await basePrisma.$connect();
   console.log("✅ Connecté à la base de données principale (avec Firestore Auto-Sync)");
 } catch (err) {
   console.error("❌ Impossible de se connecter à la base de données", err);
   throw err;
 }
};