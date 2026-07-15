import { prisma } from "../config/database.js";

export const newsletterRepository = {
  async findByEmail(email: string) {
    return prisma.newsletterSubscriber.findUnique({ where: { email } });
  },

  async findByUnsubscribeToken(token: string) {
    return prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
  },

  /** Inscription (ou réactivation si l'email était désinscrit). */
  async subscribe(email: string, source: string = "footer") {
    return prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, source },
      update: { isActive: true, unsubscribedAt: null },
    });
  },

  async unsubscribeByToken(token: string) {
    return prisma.newsletterSubscriber.update({
      where: { unsubscribeToken: token },
      data: { isActive: false, unsubscribedAt: new Date() },
    });
  },

  async findAllActiveEmails(): Promise<string[]> {
    const subs = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { email: true },
    });
    return subs.map((s) => s.email);
  },

  async countActive(): Promise<number> {
    return prisma.newsletterSubscriber.count({ where: { isActive: true } });
  },
};
