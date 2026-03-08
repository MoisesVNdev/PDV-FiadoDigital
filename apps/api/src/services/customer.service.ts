import { CustomerRepository } from "../repositories/customer.repository.js";
import type { CreateCustomerPayload } from "@pdv/shared";

const customerRepository = new CustomerRepository();

export class CustomerService {
  async list() {
    return customerRepository.findAll();
  }

  async getById(id: string) {
    const customer = await customerRepository.findById(id);

    if (!customer) {
      throw new Error("Cliente não encontrado");
    }

    return customer;
  }

  async create(payload: CreateCustomerPayload) {
    return customerRepository.create(payload);
  }

  async update(id: string, payload: Partial<CreateCustomerPayload>) {
    return customerRepository.update(id, payload);
  }

  async deactivate(id: string) {
    return customerRepository.softDelete(id);
  }
}
