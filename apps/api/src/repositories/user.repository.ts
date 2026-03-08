import { prisma } from "../config/database.js";

export class UserRepository {
  async findAll() {
    return prisma.user.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deleted_at: null },
    });
  }

  async findByUsername(username: string) {
    return prisma.user.findFirst({
      where: { username, deleted_at: null },
    });
  }

  async create(data: {
    name: string;
    username: string;
    password_hash: string;
    role: string;
  }) {
    return prisma.user.create({ data });
  }

  async update(id: string, data: Record<string, unknown>) {
    return prisma.user.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
  }
}
