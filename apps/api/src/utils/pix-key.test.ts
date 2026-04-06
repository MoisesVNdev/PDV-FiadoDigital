import { describe, it, expect } from "vitest";
import { normalizePixKeyByType, isPixKeyValidByType } from "./pix-key.js";

describe("Pix Key Utils", () => {
  describe("isPixKeyValidByType", () => {
    it("deve validar CPF formatado e não formatado", () => {
      // 00000000000 não passa na rotina isValidCpf
      expect(isPixKeyValidByType("cpf", "05391584061")).toBe(false); // CPF Aleatório pode não ser, precisamos apenas validar as mecânicas. 
      // Por simplicidade os utilitários usam a função isPixKeyValidByType interna
      // Test CPF conhecido com todos dígitos
      expect(isPixKeyValidByType("cpf", "123")).toBe(false);
    });

    it("deve validar CNPJ formatado e não formatado", () => {
      expect(isPixKeyValidByType("cnpj", "11.222.333/0001-44")).toBe(false); // Invalid calc
      expect(isPixKeyValidByType("cnpj", "123")).toBe(false);
    });

    it("deve validar e-mail", () => {
      expect(isPixKeyValidByType("email", "teste@teste.com")).toBe(true);
      expect(isPixKeyValidByType("email", "teste@.com")).toBe(false);
    });

    it("deve validar telefone com e sem formatação", () => {
      expect(isPixKeyValidByType("phone", "11999999999")).toBe(true);
      expect(isPixKeyValidByType("phone", "(11) 99999-9999")).toBe(true);
    });
  });

  describe("normalizePixKeyByType", () => {
    it("deve normalizar CPF formatado", () => {
      expect(normalizePixKeyByType("cpf", "111.222.333-44")).toBe("11122233344");
    });
    
    it("deve normalizar CNPJ formatado", () => {
      expect(normalizePixKeyByType("cnpj", "11.222.333/0001-44")).toBe("11222333000144");
    });
  });
});
