type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export function useSettingsDomain() {
  function normalizeDigits(value: string): string {
    return value.replace(/\D/g, "");
  }

  function isValidCpf(value: string): boolean {
    const digits = normalizeDigits(value);

    if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
      return false;
    }

    let sum = 0;

    for (let index = 0; index < 9; index += 1) {
      sum += Number(digits[index]) * (10 - index);
    }

    const firstDigit = (sum * 10) % 11;

    if ((firstDigit === 10 ? 0 : firstDigit) !== Number(digits[9])) {
      return false;
    }

    sum = 0;

    for (let index = 0; index < 10; index += 1) {
      sum += Number(digits[index]) * (11 - index);
    }

    const secondDigit = (sum * 10) % 11;
    return (secondDigit === 10 ? 0 : secondDigit) === Number(digits[10]);
  }

  function isValidCnpj(value: string): boolean {
    const digits = normalizeDigits(value);

    if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) {
      return false;
    }

    const calculateDigit = (base: string, factors: number[]): number => {
      const total = base
        .split("")
        .reduce((sum, digit, index) => sum + Number(digit) * (factors[index] ?? 0), 0);
      const remainder = total % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const firstDigit = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

    if (firstDigit !== Number(digits[12])) {
      return false;
    }

    const secondDigit = calculateDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return secondDigit === Number(digits[13]);
  }

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function isValidUuidV4(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
  }

  function sanitizePixKeyInput(type: PixKeyType | "", value: string): string {
    const trimmed = value.trim();

    if (type === "cpf" || type === "cnpj" || type === "phone") {
      return normalizeDigits(trimmed);
    }

    return trimmed;
  }

  function validatePixKey(type: PixKeyType | "", value: string): string[] | undefined {
    if (!type) {
      return ["Selecione o tipo de chave Pix."];
    }

    const normalized = sanitizePixKeyInput(type, value);

    if (!normalized) {
      return ["Chave Pix e obrigatoria."];
    }

    if (type === "cpf" && !isValidCpf(normalized)) {
      return ["Informe um CPF valido com 11 digitos."];
    }

    if (type === "cnpj" && !isValidCnpj(normalized)) {
      return ["Informe um CNPJ valido com 14 digitos."];
    }

    if (type === "email" && !isValidEmail(normalized)) {
      return ["Informe um e-mail valido."];
    }

    if (type === "phone" && !/^\d{11}$/.test(normalized)) {
      return ["Informe um telefone valido com DDD e 9 digitos."];
    }

    if (type === "random" && !isValidUuidV4(normalized)) {
      return ["Informe uma chave aleatoria valida no formato UUID v4."];
    }

    return undefined;
  }

  function parseRateInput(value: string): number | null {
    const normalized = value.replace(",", ".").trim();

    if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) {
      return null;
    }

    const parsed = Number.parseFloat(normalized);

    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      return null;
    }

    return parsed;
  }

  return {
    normalizeDigits,
    sanitizePixKeyInput,
    validatePixKey,
    parseRateInput,
  };
}
