import type { CreateCardMachinePayload, UpdateCardMachinePayload } from "@pdv/shared";
import { CardMachineRepository } from "../repositories/card-machine.repository.js";

const cardMachineRepository = new CardMachineRepository();

export class CardMachineService {
  async list(onlyActive = false) {
    return cardMachineRepository.findAll({ onlyActive });
  }

  async create(payload: CreateCardMachinePayload) {
    const normalizedName = payload.name.trim();

    if (!normalizedName) {
      throw new Error("Nome da maquininha é obrigatório");
    }

    return cardMachineRepository.create({
      ...payload,
      name: normalizedName,
    });
  }

  async update(id: string, payload: UpdateCardMachinePayload) {
    const existing = await cardMachineRepository.findById(id);

    if (!existing) {
      throw new Error("Maquininha não encontrada");
    }

    return cardMachineRepository.update(id, {
      ...payload,
      ...(typeof payload.name === "string" ? { name: payload.name.trim() } : {}),
    });
  }

  async deactivate(id: string) {
    const existing = await cardMachineRepository.findById(id);

    if (!existing) {
      throw new Error("Maquininha não encontrada");
    }

    return cardMachineRepository.softDelete(id);
  }
}
