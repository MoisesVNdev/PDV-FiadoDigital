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
    return customerRepository.create({
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      credit_limit_cents: payload.credit_limit_cents,
      payment_due_day: payload.payment_due_day,
      is_active: payload.is_active,
    });
  }

  async update(id: string, payload: Partial<CreateCustomerPayload>) {
    const updatePayload: Partial<CreateCustomerPayload> = {};

    if (typeof payload.name === "string") {
      updatePayload.name = payload.name;
    }

    if (typeof payload.phone === "string") {
      updatePayload.phone = payload.phone;
    }

    if (typeof payload.email === "string") {
      updatePayload.email = payload.email;
    }

    if (typeof payload.credit_limit_cents === "number") {
      updatePayload.credit_limit_cents = payload.credit_limit_cents;
    }

    if (typeof payload.payment_due_day === "number") {
      updatePayload.payment_due_day = payload.payment_due_day;
    }

    if (typeof payload.is_active === "boolean") {
      updatePayload.is_active = payload.is_active;
    }

    return customerRepository.update(id, updatePayload);
  }

  async deactivate(id: string) {
    return customerRepository.softDelete(id);
  }
}
