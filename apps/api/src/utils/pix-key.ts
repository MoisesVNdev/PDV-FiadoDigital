export const PIX_KEY_TYPES = ["cpf", "cnpj", "email", "phone", "random"] as const;

export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizePixKeyByType(type: PixKeyType, rawValue: string): string {
  const trimmedValue = rawValue.trim();

  if (type === "cpf" || type === "cnpj" || type === "phone") {
    return trimmedValue.replace(/\D/g, "");
  }

  return trimmedValue;
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");

  if (!/^\d{11}$/.test(digits)) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(digits)) {
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

export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");

  if (!/^\d{14}$/.test(digits)) {
    return false;
  }

  if (/^(\d)\1{13}$/.test(digits)) {
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

export function isValidRandomPixKey(value: string): boolean {
  return uuidV4Pattern.test(value.trim());
}

export function getPixKeyValidationMessage(type: PixKeyType): string {
  if (type === "cpf") {
    return "Informe um CPF válido com 11 dígitos.";
  }

  if (type === "cnpj") {
    return "Informe um CNPJ válido com 14 dígitos.";
  }

  if (type === "email") {
    return "Informe um e-mail válido.";
  }

  if (type === "phone") {
    return "Informe um telefone válido com DDD e 9 dígitos.";
  }

  return "Informe uma chave aleatória válida no formato UUID v4.";
}

export function isPixKeyValidByType(type: PixKeyType, rawValue: string): boolean {
  const normalizedValue = normalizePixKeyByType(type, rawValue);

  if (type === "cpf") {
    return isValidCpf(normalizedValue);
  }

  if (type === "cnpj") {
    return isValidCnpj(normalizedValue);
  }

  if (type === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue);
  }

  if (type === "phone") {
    return /^\d{11}$/.test(normalizedValue);
  }

  return isValidRandomPixKey(normalizedValue);
}

export function formatPixKeyForPayload(type: PixKeyType, rawValue: string): string {
  const normalizedValue = normalizePixKeyByType(type, rawValue);

  if (type === "phone") {
    return `+55${normalizedValue}`;
  }

  return normalizedValue;
}