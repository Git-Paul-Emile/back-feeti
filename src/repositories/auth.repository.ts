import { prisma } from "../config/database.js";
import type { Role } from "../generated/prisma/client.js";

export const authRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByFirebaseUid(firebaseUid: string) {
    return prisma.user.findUnique({ where: { firebaseUid } });
  },

  async updateUser(id: string, data: {
    name?: string;
    email?: string;
    phone?: string | null;
    passwordHash?: string;
    interests?: string;
    firebaseUid?: string;
    photoUrl?: string | null;
    role?: Role;
    country?: string;
    city?: string;
  }) {
    return prisma.user.update({ where: { id }, data });
  },

  async deleteUser(id: string) {
    return prisma.user.delete({ where: { id } });
  },

  async createUser(data: {
    name: string;
    email: string;
    phone?: string;
    passwordHash: string;
    role: Role;
    interests?: string;
    firebaseUid?: string;
    photoUrl?: string | null;
    country?: string;
    city?: string;
  }) {
    return prisma.user.create({ data });
  },

  async findAll() {
    return prisma.user.findMany();
  },
};
