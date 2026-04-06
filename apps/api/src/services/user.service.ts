import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/user.repository.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import type { CreateUserPayload } from "@pdv/shared";
import type { UpdateUserData } from "@pdv/shared";

const userRepository = new UserRepository();
const auditLogRepository = new AuditLogRepository();

export class UserService {
  async list() {
    return userRepository.findAll();
  }

  async getById(id: string) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    return user;
  }

  async create(payload: CreateUserPayload) {
    const existing = await userRepository.findByUsername(payload.username);

    if (existing) {
      throw new Error("Nome de usuário já existe");
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    return userRepository.create({
      name: payload.name,
      username: payload.username,
      password_hash: passwordHash,
      role: payload.role,
      can_view_cost_price: payload.can_view_cost_price ?? false,
    });
  }

  async update(id: string, payload: Partial<CreateUserPayload>, changedById: string) {
    const { password, name, username, can_view_cost_price, is_active } = payload;
    const updateData: UpdateUserData = {
      name,
      username,
      can_view_cost_price,
      is_active,
    };

    if (password) {
      const password_hash = await bcrypt.hash(password, 12);
      const updatedUser = await userRepository.update(id, { ...updateData, password_hash });

      await auditLogRepository.create({
        action: "password_changed",
        actor_id: changedById,
        entity_type: "user",
        entity_id: id,
        details: { target_user_id: id, changed_by_id: changedById },
      });

      return updatedUser;
    }

    return userRepository.update(id, updateData);
  }

  async deactivate(id: string, operatorId: string) {
    const result = await userRepository.softDelete(id);

    await auditLogRepository.create({
      action: "user_deleted",
      actor_id: operatorId,
      entity_type: "user",
      entity_id: id,
      details: { target_user_id: id },
    });

    return result;
  }
}
