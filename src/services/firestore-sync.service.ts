import { db, FieldValue, Timestamp } from '../config/firebase-admin.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SyncOptions {
  collection: string;
  data: Record<string, unknown>;
  id: string;
}

interface SyncResult {
  success: boolean;
  collection: string;
  docId: string;
  error?: string;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const COLLECTIONS = {
  USERS: 'users',
  EVENTS: 'events',
  TICKETS: 'tickets',
  TRANSACTIONS: 'transactions',
  ZONES: 'zones',
  BADGES: 'badges',
  ACCESS_LOGS: 'access_logs',
  LOYALTY: 'loyalty',
  WALLETS: 'wallets',
} as const;

// ─── Service principal ────────────────────────────────────────────────────────

class FirestoreSyncService {
  private get isEnabled(): boolean {
    return process.env.FIRESTORE_SYNC_ENABLED === 'true';
  }

  constructor() {
    // Le check statique ici n'est pas fiable avec dotenv
  }

  // ── Synchroniser un document ─────────────────────────────────────────────
  async syncDocument({ collection, data, id }: SyncOptions): Promise<SyncResult> {
    if (!this.isEnabled) {
      return { success: false, collection, docId: id, error: 'Sync disabled' };
    }

    try {
      const docRef = db.collection(collection).doc(id);
      
      await docRef.set({
        ...data,
        _syncTimestamp: FieldValue.serverTimestamp(),
        _source: 'postgresql',
        _updatedAt: Timestamp.now(),
      }, { merge: true });

      logger.info(`✅ Sync: ${collection}/${id}`);
      return { success: true, collection, docId: id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Sync error: ${collection}/${id} - ${message}`);
      return { success: false, collection, docId: id, error: message };
    }
  }

  // Convertir les types Prisma (Date, Decimal) en types compatibles JS/Firestore
  private serializeData(data: any): any {
    if (data === null || data === undefined) return data;
    if (data instanceof Date) return data.toISOString();
    // Gérer les objets Decimal de Prisma si présents (ils ont une méthode toNumber ou toString)
    if (typeof data === 'object' && data.constructor?.name === 'Decimal' && typeof data.toNumber === 'function') {
      return data.toNumber();
    }
    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        return data.map((item) => this.serializeData(item));
      }
      const serialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this.serializeData(value);
      }
      return serialized;
    }
    return data;
  }

  // ── Synchroniser un document Générique ───────────────────────────────────
  async syncGeneric(collectionName: string, id: string, data: any) {
    return this.syncDocument({
      collection: collectionName,
      id,
      data: this.serializeData(data),
    });
  }

  // ── Supprimer un document Générique ──────────────────────────────────────
  async deleteGeneric(collectionName: string, id: string) {
    return this.deleteDocument(collectionName, id);
  }

  // ── Supprimer un document ─────────────────────────────────────────────────
  async deleteDocument(collection: string, id: string): Promise<SyncResult> {
    if (!this.isEnabled) {
      return { success: false, collection, docId: id, error: 'Sync disabled' };
    }

    try {
      await db.collection(collection).doc(id).delete();
      logger.info(`🗑️ Delete: ${collection}/${id}`);
      return { success: true, collection, docId: id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Delete error: ${collection}/${id} - ${message}`);
      return { success: false, collection, docId: id, error: message };
    }
  }

  // ── Synchroniser un utilisateur ───────────────────────────────────────────
  async syncUser(user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    avatar?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return this.syncDocument({
      collection: COLLECTIONS.USERS,
      id: user.id,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  }

  // ── Synchroniser un événement ──────────────────────────────────────────────
  async syncEvent(event: any) {
    return this.syncDocument({
      collection: COLLECTIONS.EVENTS,
      id: event.id,
      data: {
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date instanceof Date ? event.date.toISOString() : String(event.date),
        time: event.time,
        location: event.location,
        image: event.image,
        price: event.price,
        vipPrice: event.vipPrice,
        category: event.category,
        type: event.type || event.eventType,
        status: event.status,
        maxAttendees: event.maxAttendees,
        attendees: event.attendees || 0,
        salesBlocked: event.salesBlocked,
        isFeatured: event.isFeatured || false,
        isLive: event.isLive || false,
        organizerId: event.organizerId,
        createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : String(event.createdAt),
        updatedAt: event.updatedAt instanceof Date ? event.updatedAt.toISOString() : String(event.updatedAt),
      },
    });
  }

  // ── Synchroniser un billet ─────────────────────────────────────────────────
  async syncTicket(ticket: {
    id: string;
    eventId: string;
    userId: string;
    type: string;
    status: string;
    qrCode?: string | null;
    usedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return this.syncDocument({
      collection: COLLECTIONS.TICKETS,
      id: ticket.id,
      data: {
        id: ticket.id,
        eventId: ticket.eventId,
        userId: ticket.userId,
        type: ticket.type,
        status: ticket.status,
        qrCode: ticket.qrCode,
        usedAt: ticket.usedAt?.toISOString() || null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      },
    });
  }

  // ── Synchroniser une transaction ──────────────────────────────────────────
  async syncTransaction(transaction: {
    id: string;
    userId: string;
    eventId?: string | null;
    amount: number;
    currency: string;
    status: string;
    paymentMethod: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return this.syncDocument({
      collection: COLLECTIONS.TRANSACTIONS,
      id: transaction.id,
      data: {
        id: transaction.id,
        userId: transaction.userId,
        eventId: transaction.eventId,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
      },
    });
  }

  // ── Synchroniser un badge ───────────────────────────────────────────────────
  async syncBadge(badge: {
    id: string;
    eventId: string;
    holderName: string;
    holderPhone?: string | null;
    category?: string | null;
    zoneId?: string | null;
    status: string;
    qrData?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return this.syncDocument({
      collection: COLLECTIONS.BADGES,
      id: badge.id,
      data: {
        id: badge.id,
        eventId: badge.eventId,
        holderName: badge.holderName,
        holderPhone: badge.holderPhone,
        category: badge.category,
        zoneId: badge.zoneId,
        status: badge.status,
        qrData: badge.qrData,
        createdAt: badge.createdAt.toISOString(),
        updatedAt: badge.updatedAt.toISOString(),
      },
    });
  }

  // ── Synchroniser un log de scan d'accès ─────────────────────────────────────
  async syncAccessLog(log: {
    id: string;
    badgeId: string;
    zoneId: string;
    eventId: string;
    scannedById: string;
    result: string;
    refusalReason?: string | null;
    offlineSync: boolean;
    scannedAt: Date;
  }) {
    return this.syncDocument({
      collection: COLLECTIONS.ACCESS_LOGS,
      id: log.id,
      data: {
        id: log.id,
        badgeId: log.badgeId,
        zoneId: log.zoneId,
        eventId: log.eventId,
        scannedById: log.scannedById,
        result: log.result,
        refusalReason: log.refusalReason ?? null,
        offlineSync: log.offlineSync,
        scannedAt: log.scannedAt.toISOString(),
      },
    });
  }

  // ── Synchroniser un wallet ──────────────────────────────────────────────────
  async syncWallet(wallet: {
    id: string;
    userId: string;
    balance: number;
    pendingBalance: number;
    currency: string;
    updatedAt: Date;
  }) {
    return this.syncDocument({
      collection: COLLECTIONS.WALLETS,
      id: wallet.id,
      data: {
        id: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        currency: wallet.currency,
        updatedAt: wallet.updatedAt.toISOString(),
      },
    });
  }

  // ── Synchroniser une zone ───────────────────────────────────────────────────
  async syncZone(zone: {
    id: string;
    eventId: string;
    code: string;
    name: string;
    description?: string | null;
    color: string;
    isActive: boolean;
    maxCapacity?: number | null;
    currentCount: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return this.syncDocument({
      collection: COLLECTIONS.ZONES,
      id: zone.id,
      data: {
        id: zone.id,
        eventId: zone.eventId,
        code: zone.code,
        name: zone.name,
        description: zone.description,
        color: zone.color,
        isActive: zone.isActive,
        maxCapacity: zone.maxCapacity,
        currentCount: zone.currentCount,
        createdAt: zone.createdAt.toISOString(),
        updatedAt: zone.updatedAt.toISOString(),
      },
    });
  }

  // ── Synchroniser un profil de fidélité ──────────────────────────────────────
  async syncLoyalty(loyalty: {
    id: string;
    userId: string;
    points: number;
    pointsEarned: number;
    pointsSpent: number;
    level: string;
    eventsAttended: number;
    totalSpent: number;
    referralCode: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return this.syncDocument({
      collection: COLLECTIONS.LOYALTY,
      id: loyalty.id,
      data: {
        id: loyalty.id,
        userId: loyalty.userId,
        points: loyalty.points,
        pointsEarned: loyalty.pointsEarned,
        pointsSpent: loyalty.pointsSpent,
        level: loyalty.level,
        eventsAttended: loyalty.eventsAttended,
        totalSpent: loyalty.totalSpent,
        referralCode: loyalty.referralCode,
        createdAt: loyalty.createdAt.toISOString(),
        updatedAt: loyalty.updatedAt.toISOString(),
      },
    });
  }

  // ── Resynchronisation complète ──────────────────────────────────────────────
  async resyncAll(model: 'events' | 'users' | 'tickets' | 'transactions' | 'zones' | 'badges' | 'loyalty' | 'wallets') {
    logger.info(`🔄 Starting full resync: ${model}`);
    
    let count = 0;
    let errors = 0;

    try {
      switch (model) {
        case 'events': {
          const events = await prisma.event.findMany({ take: 100 });
          for (const event of events) {
            const result = await this.syncEvent({
              id: event.id,
              title: event.title,
              description: event.description,
              date: new Date(event.date),
              time: event.time,
              location: event.location,
              image: event.image,
              price: event.price,
              vipPrice: event.vipPrice,
              category: event.category,
              type: event.eventType,
              status: event.status,
              maxAttendees: event.maxAttendees,
              attendees: event.attendees,
              salesBlocked: event.salesBlocked,
              isFeatured: event.isFeatured,
              isLive: event.isLive,
              organizerId: event.organizerId,
              createdAt: event.createdAt,
              updatedAt: event.updatedAt,
            });
            if (result.success) count++;
            else errors++;
          }
          break;
        }
        case 'users': {
          const users = await prisma.user.findMany({ take: 100 });
          for (const user of users) {
            const result = await this.syncUser({
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              avatar: user.photoUrl,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            });
            if (result.success) count++;
            else errors++;
          }
          break;
        }
        case 'tickets': {
          const tickets = await prisma.ticket.findMany({ take: 100 });
          for (const ticket of tickets) {
            const result = await this.syncTicket({
              id: ticket.id,
              eventId: ticket.eventId,
              userId: ticket.userId,
              type: ticket.category,
              status: ticket.status,
              qrCode: ticket.qrData,
              usedAt: ticket.usedAt,
              createdAt: ticket.createdAt,
              updatedAt: ticket.updatedAt,
            });
            if (result.success) count++;
            else errors++;
          }
          break;
        }
        case 'transactions': {
          const transactions = await prisma.transaction.findMany({ take: 100 });
          for (const tx of transactions) {
            const result = await this.syncTransaction({
              id: tx.id,
              userId: tx.buyerId,
              eventId: tx.eventId,
              amount: tx.montantTTC,
              currency: tx.devise,
              status: tx.status,
              paymentMethod: tx.paymentMethod || 'unknown',
              createdAt: tx.createdAt,
              updatedAt: tx.updatedAt,
            });
            if (result.success) count++;
            else errors++;
          }
          break;
        }
        case 'zones': {
          const zones = await prisma.eventZone.findMany({ take: 100 });
          for (const zone of zones) {
            const result = await this.syncZone(zone);
            if (result.success) count++;
            else errors++;
          }
          break;
        }
        case 'badges': {
          const badges = await prisma.accessBadge.findMany({ take: 100 });
          for (const badge of badges) {
            const result = await this.syncBadge({
              id: badge.id,
              eventId: badge.eventId,
              holderName: badge.holderName,
              holderPhone: badge.holderPhone,
              category: badge.categoryId,
              zoneId: null,
              status: badge.status,
              qrData: badge.qrCode,
              createdAt: badge.createdAt,
              updatedAt: badge.updatedAt,
            });
            if (result.success) count++;
            else errors++;
          }
          break;
        }
        case 'loyalty': {
          const loyalties = await prisma.loyaltyProfile.findMany({ take: 100 });
          for (const loyalty of loyalties) {
            const result = await this.syncLoyalty({
              id: loyalty.id,
              userId: loyalty.userId,
              points: loyalty.points,
              pointsEarned: loyalty.pointsEarned,
              pointsSpent: loyalty.pointsSpent,
              level: loyalty.level,
              eventsAttended: loyalty.eventsAttended,
              totalSpent: loyalty.totalSpent,
              referralCode: loyalty.referralCode,
              createdAt: loyalty.createdAt,
              updatedAt: loyalty.updatedAt,
            });
            if (result.success) count++;
            else errors++;
          }
          break;
        }
        case 'wallets': {
          const wallets = await prisma.wallet.findMany({ take: 100 });
          for (const wallet of wallets) {
            const result = await this.syncWallet({
              id: wallet.id,
              userId: wallet.organizerId,
              balance: wallet.soldeDisponible,
              pendingBalance: wallet.soldeEnAttente,
              currency: wallet.devise,
              updatedAt: wallet.updatedAt,
            });
            if (result.success) count++;
            else errors++;
          }
          break;
        }
      }

      logger.info(`✅ Resync complete: ${count} synced, ${errors} errors`);
      return { synced: count, errors };
    } catch (error) {
      logger.error(`❌ Resync failed: ${error}`);
      throw error;
    }
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const firestoreSyncService = new FirestoreSyncService();
export default firestoreSyncService;