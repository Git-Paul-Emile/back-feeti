/**
 * ═══════════════════════════════════════════════════════════════════════
 *  SERVICE DE REPORTING & ANALYTICS FINANCIERS
 *  Tableaux de bord, KPIs, exports CSV/PDF, rapports TVA
 * ═══════════════════════════════════════════════════════════════════════
 */

import { prisma } from "../config/database.js";
import { formatMontant, agregerRepartitions, centimesToXOF } from "../utils/financial.js";

// ─── Types de reporting ───────────────────────────────────────────────

export interface PeriodFilter {
  dateFrom: Date;
  dateTo: Date;
}

export interface OrganizerDashboard {
  kpis: {
    totalGagne: number;
    totalGagneFormatted: string;
    soldeDisponible: number;
    soldeDisponibleFormatted: string;
    totalBilletsVendus: number;
    totalTransactions: number;
    tauxRemboursement: number;
    croissance: number; // % vs période précédente
  };
  revenusParEvenement: Array<{
    eventId: string;
    eventTitle: string;
    billets: number;
    montantTTC: number;
    montantHT: number;
    tva: number;
    commission: number;
    netOrganisateur: number;
    formatted: { net: string; ttc: string };
  }>;
  tvaCollectee: {
    total: number;
    formatted: string;
    periodeLabel: string;
  };
  commissionsPayees: {
    total: number;
    formatted: string;
  };
  topEvenements: Array<{
    eventId: string;
    titre: string;
    revenus: number;
    billets: number;
  }>;
}

export interface AdminDashboard {
  fluxFinanciers: {
    totalEntrees: number;      // Σ TTC toutes transactions completed
    totalTVACollectee: number;
    totalCommissions: number;
    totalVersesOrganisateurs: number;
    soldesPlateforme: number;  // commissions non encore versées
  };
  topOrganisateurs: Array<{
    organizerId: string;
    nom: string;
    totalTransactions: number;
    totalTTC: number;
    totalNet: number;
  }>;
  transactionsEnLitige: number;
  alertes: string[];
  repartitionParStatut: Array<{
    status: string;
    count: number;
    totalTTC: number;
  }>;
}

export const reportingService = {

  // ─── Dashboard organisateur ─────────────────────────────────────────
  async getDashboardOrganisateur(
    organizerId: string,
    periode: PeriodFilter
  ): Promise<OrganizerDashboard> {
    const { dateFrom, dateTo } = periode;

    // Données de la période courante
    const [aggregat, transactionsParEvent, wallet, totalBillets, refunds] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          organizerId,
          status: { in: ["completed", "paid"] },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: {
          montantTTC: true,
          montantHT: true,
          tva: true,
          commission: true,
          netOrganisateur: true,
        },
        _count: { id: true },
      }),

      prisma.transaction.groupBy({
        by: ["eventId"],
        where: {
          organizerId,
          status: { in: ["completed", "paid"] },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: {
          montantTTC: true,
          montantHT: true,
          tva: true,
          commission: true,
          netOrganisateur: true,
        },
        _count: { id: true },
      }),

      prisma.wallet.findUnique({
        where: { organizerId },
        select: { soldeDisponible: true, totalRetire: true, devise: true },
      }),

      prisma.ticket.count({
        where: {
          event: { organizerId },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      }),

      prisma.transaction.count({
        where: {
          organizerId,
          status: { in: ["refunded", "partially_refunded"] },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      }),
    ]);

    // Période précédente pour calcul croissance
    const duree = dateTo.getTime() - dateFrom.getTime();
    const prevDateFrom = new Date(dateFrom.getTime() - duree);
    const prevDateTo = new Date(dateTo.getTime() - duree);

    const prevAggregat = await prisma.transaction.aggregate({
      where: {
        organizerId,
        status: { in: ["completed", "paid"] },
        createdAt: { gte: prevDateFrom, lte: prevDateTo },
      },
      _sum: { netOrganisateur: true },
    });

    const totalCourant = aggregat._sum.netOrganisateur ?? 0;
    const totalPrecedent = prevAggregat._sum.netOrganisateur ?? 0;
    const croissance = totalPrecedent > 0
      ? Math.round(((totalCourant - totalPrecedent) / totalPrecedent) * 100)
      : 0;

    const totalTx = aggregat._count.id;
    const tauxRemboursement = totalTx > 0 ? Math.round((refunds / totalTx) * 100) : 0;

    // Enrichir avec les titres des événements
    const eventIds = transactionsParEvent.map((t) => t.eventId);
    const events = await prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, title: true },
    });
    const eventMap = new Map(events.map((e) => [e.id, e.title]));

    const devise = wallet?.devise ?? "XOF";

    const revenusParEvenement = transactionsParEvent.map((t) => ({
      eventId: t.eventId,
      eventTitle: eventMap.get(t.eventId) ?? "Événement inconnu",
      billets: t._count.id,
      montantTTC: t._sum.montantTTC ?? 0,
      montantHT: t._sum.montantHT ?? 0,
      tva: t._sum.tva ?? 0,
      commission: t._sum.commission ?? 0,
      netOrganisateur: t._sum.netOrganisateur ?? 0,
      formatted: {
        net: formatMontant(t._sum.netOrganisateur ?? 0, devise),
        ttc: formatMontant(t._sum.montantTTC ?? 0, devise),
      },
    }));

    const topEvenements = [...revenusParEvenement]
      .sort((a, b) => b.netOrganisateur - a.netOrganisateur)
      .slice(0, 5)
      .map((e) => ({
        eventId: e.eventId,
        titre: e.eventTitle,
        revenus: e.netOrganisateur,
        billets: e.billets,
      }));

    return {
      kpis: {
        totalGagne: totalCourant,
        totalGagneFormatted: formatMontant(totalCourant, devise),
        soldeDisponible: wallet?.soldeDisponible ?? 0,
        soldeDisponibleFormatted: formatMontant(wallet?.soldeDisponible ?? 0, devise),
        totalBilletsVendus: totalBillets,
        totalTransactions: totalTx,
        tauxRemboursement,
        croissance,
      },
      revenusParEvenement,
      tvaCollectee: {
        total: aggregat._sum.tva ?? 0,
        formatted: formatMontant(aggregat._sum.tva ?? 0, devise),
        periodeLabel: `${dateFrom.toLocaleDateString("fr-FR")} – ${dateTo.toLocaleDateString("fr-FR")}`,
      },
      commissionsPayees: {
        total: aggregat._sum.commission ?? 0,
        formatted: formatMontant(aggregat._sum.commission ?? 0, devise),
      },
      topEvenements,
    };
  },

  // ─── Dashboard admin ────────────────────────────────────────────────
  async getDashboardAdmin(periode: PeriodFilter): Promise<AdminDashboard> {
    const { dateFrom, dateTo } = periode;

    const [
      fluxAggregat,
      payoutsCompleted,
      transactionsParStatut,
      topOrganisateurRaw,
      litiges,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          status: { in: ["completed", "paid"] },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: {
          montantTTC: true,
          tva: true,
          commission: true,
          netOrganisateur: true,
        },
      }),

      prisma.payout.aggregate({
        where: {
          statut: "completed",
          completedAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: { montant: true },
      }),

      prisma.transaction.groupBy({
        by: ["status"],
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
        _sum: { montantTTC: true },
        _count: { id: true },
      }),

      prisma.transaction.groupBy({
        by: ["organizerId"],
        where: {
          status: { in: ["completed", "paid"] },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: { montantTTC: true, netOrganisateur: true },
        _count: { id: true },
        orderBy: { _sum: { montantTTC: "desc" } },
        take: 10,
      }),

      prisma.transaction.count({
        where: { status: "disputed" },
      }),
    ]);

    const totalTTC = fluxAggregat._sum.montantTTC ?? 0;
    const totalTVA = fluxAggregat._sum.tva ?? 0;
    const totalCommissions = fluxAggregat._sum.commission ?? 0;
    const totalVersesOrg = payoutsCompleted._sum.montant ?? 0;

    const orgIds = topOrganisateurRaw.map((o) => o.organizerId);
    const orgs = await prisma.user.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

    const topOrganisateurs = topOrganisateurRaw.map((o) => ({
      organizerId: o.organizerId,
      nom: orgMap.get(o.organizerId) ?? "Inconnu",
      totalTransactions: o._count.id,
      totalTTC: o._sum.montantTTC ?? 0,
      totalNet: o._sum.netOrganisateur ?? 0,
    }));

    const alertes: string[] = [];
    if (litiges > 10) alertes.push(`⚠️ ${litiges} transactions en litige`);

    const repartitionParStatut = transactionsParStatut.map((t) => ({
      status: t.status,
      count: t._count.id,
      totalTTC: t._sum.montantTTC ?? 0,
    }));

    return {
      fluxFinanciers: {
        totalEntrees: totalTTC,
        totalTVACollectee: totalTVA,
        totalCommissions,
        totalVersesOrganisateurs: totalVersesOrg,
        soldesPlateforme: totalCommissions,
      },
      topOrganisateurs,
      transactionsEnLitige: litiges,
      alertes,
      repartitionParStatut,
    };
  },

  // ─── Rapport TVA pour déclaration fiscale ───────────────────────────
  async getRapportTVA(
    periode: PeriodFilter,
    organizerId?: string
  ) {
    const { dateFrom, dateTo } = periode;

    const aggregat = await prisma.transaction.aggregate({
      where: {
        status: { in: ["completed", "paid"] },
        createdAt: { gte: dateFrom, lte: dateTo },
        ...(organizerId && { organizerId }),
      },
      _sum: {
        montantTTC: true,
        montantHT: true,
        tva: true,
      },
      _count: { id: true },
    });

    // Par taux de TVA (multi-taux possible)
    const parTaux = await prisma.transaction.groupBy({
      by: ["tauxTVA", "devise"],
      where: {
        status: { in: ["completed", "paid"] },
        createdAt: { gte: dateFrom, lte: dateTo },
        ...(organizerId && { organizerId }),
      },
      _sum: { montantHT: true, tva: true, montantTTC: true },
      _count: { id: true },
    });

    return {
      periode: {
        debut: dateFrom.toISOString(),
        fin: dateTo.toISOString(),
        label: `${dateFrom.toLocaleDateString("fr-FR")} – ${dateTo.toLocaleDateString("fr-FR")}`,
      },
      totalTTC: aggregat._sum.montantTTC ?? 0,
      totalHT: aggregat._sum.montantHT ?? 0,
      totalTVA: aggregat._sum.tva ?? 0,
      nombreTransactions: aggregat._count.id,
      parTaux: parTaux.map((t) => ({
        tauxTVA: `${(t.tauxTVA / 100).toFixed(2)}%`,
        devise: t.devise,
        totalHT: t._sum.montantHT ?? 0,
        totalTVA: t._sum.tva ?? 0,
        totalTTC: t._sum.montantTTC ?? 0,
        nombre: t._count.id,
      })),
    };
  },

  // ─── Export CSV des transactions ─────────────────────────────────────
  async exportTransactionsCSV(
    filters: {
      organizerId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      status?: string;
    },
    devise: string = "XOF"
  ): Promise<string> {
    const transactions = await prisma.transaction.findMany({
      where: {
        ...(filters.organizerId && { organizerId: filters.organizerId }),
        ...(filters.status && { status: filters.status as never }),
        ...((filters.dateFrom || filters.dateTo) && {
          createdAt: {
            ...(filters.dateFrom && { gte: filters.dateFrom }),
            ...(filters.dateTo && { lte: filters.dateTo }),
          },
        }),
      },
      include: {
        event: { select: { title: true } },
        buyer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const header = [
      "ID Transaction",
      "Date",
      "Événement",
      "Acheteur",
      "Email Acheteur",
      "Statut",
      "Devise",
      "Montant TTC",
      "Montant HT",
      "TVA",
      "Commission",
      "Net Organisateur",
      "Méthode Paiement",
      "Ref Provider",
    ].join(";");

    const rows = transactions.map((t) =>
      [
        t.id,
        t.createdAt.toISOString(),
        `"${t.event.title}"`,
        `"${t.buyer.name}"`,
        t.buyer.email,
        t.status,
        t.devise,
        centimesToXOF(t.montantTTC).toFixed(2),
        centimesToXOF(t.montantHT).toFixed(2),
        centimesToXOF(t.tva).toFixed(2),
        centimesToXOF(t.commission).toFixed(2),
        centimesToXOF(t.netOrganisateur).toFixed(2),
        t.paymentMethod ?? "",
        t.paymentProviderTransactionId ?? "",
      ].join(";")
    );

    return [header, ...rows].join("\n");
  },

  // ─── Tendances de ventes par mois ────────────────────────────────────
  // organizerId = undefined → vue plateforme complète (admin)
  async getTendancesVentes(organizerId: string | undefined, mois: number = 6) {
    const dateFrom = new Date();
    dateFrom.setMonth(dateFrom.getMonth() - mois);
    dateFrom.setDate(1);
    dateFrom.setHours(0, 0, 0, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(organizerId ? { organizerId } : {}),
        status: { in: ["completed", "paid"] },
        createdAt: { gte: dateFrom },
      },
      select: {
        createdAt: true,
        montantTTC: true,
        netOrganisateur: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Grouper par mois
    const parMois: Record<string, { label: string; totalTTC: number; net: number; count: number }> = {};

    for (const tx of transactions) {
      const key = `${tx.createdAt.getFullYear()}-${String(tx.createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (!parMois[key]) {
        parMois[key] = {
          label: tx.createdAt.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
          totalTTC: 0,
          net: 0,
          count: 0,
        };
      }
      parMois[key].totalTTC += tx.montantTTC;
      parMois[key].net += tx.netOrganisateur;
      parMois[key].count += 1;
    }

    return Object.entries(parMois)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([moisKey, data]) => ({ mois: moisKey, ...data }));
  },

  // ─── Rapport de remboursements ────────────────────────────────────────
  async getRapportRemboursements(organizerId: string, periode: PeriodFilter) {
    const remboursements = await prisma.transaction.findMany({
      where: {
        organizerId,
        status: { in: ["refunded", "partially_refunded"] },
        createdAt: { gte: periode.dateFrom, lte: periode.dateTo },
      },
      include: {
        event: { select: { title: true } },
        buyer: { select: { name: true, email: true } },
      },
    });

    const totalRembourse = remboursements.reduce(
      (sum, t) => sum + (t.refundAmount ?? t.montantTTC),
      0
    );

    return {
      remboursements,
      total: totalRembourse,
      count: remboursements.length,
    };
  },
};
