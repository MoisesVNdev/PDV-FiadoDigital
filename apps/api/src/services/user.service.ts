import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/user.repository.js";
import type { CreateUserPayload } from "@pdv/shared";

const userRepository = new UserRepository();

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
    });
  }

  async update(id: string, payload: Partial<CreateUserPayload>) {
    return userRepository.update(id, payload);
  }

  async deactivate(id: string) {
    return userRepository.softDelete(id);
  }
}
