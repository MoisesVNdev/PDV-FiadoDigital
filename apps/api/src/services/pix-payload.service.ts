/**
 * Gerador de QR Code Pix estático (EMVCo BR Code)
 * Baseado no padrão do Banco Central do Brasil
 * https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II-ManualdePadroesparaIniciacaodoPix.pdf
 */

import {
  formatPixKeyForPayload,
  isPixKeyValidByType,
  type PixKeyType,
} from "../utils/pix-key.js";

type PixPayloadInput = {
  pixKeyType: PixKeyType;
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amountCents: number;
};

/**
 * Calcula o CRC16/CCITT-FALSE para validação do payload EMVCo.
 */
function calculateCRC16(payload: string): string {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  
  const result = (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return result;
}

/**
 * Formata um campo TLV (Tag-Length-Value)
 */
function formatTLV(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${tag}${length}${value}`;
}

/**
 * Remove acentos, trim e transforma em maiúsculas para campos do recebedor.
 */
function sanitizeMerchantField(value: string, maxLength: number): string {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return normalized.slice(0, maxLength);
}

/**
 * Converte centavos para reais com ponto decimal sem usar float.
 */
function formatAmountFromCents(amountCents: number): string {
  const integerPart = Math.floor(amountCents / 100);
  const centsPart = amountCents % 100;
  return `${integerPart}.${centsPart.toString().padStart(2, "0")}`;
}

/**
 * Gera o payload EMVCo para QR Code Pix estático.
 */
export function generatePixPayload(input: PixPayloadInput): string {
  const pixKey = formatPixKeyForPayload(input.pixKeyType, input.pixKey);
  const merchantName = sanitizeMerchantField(input.merchantName, 25);
  const merchantCity = sanitizeMerchantField(input.merchantCity, 15);
  const amountStr = formatAmountFromCents(input.amountCents);

  const merchantAccountInfo =
    formatTLV("00", "BR.GOV.BCB.PIX") +
    formatTLV("01", pixKey);

  const additionalDataField = formatTLV("05", "***");

  const payloadWithoutCrc =
    formatTLV("00", "01") +
    formatTLV("26", merchantAccountInfo) +
    formatTLV("52", "0000") +
    formatTLV("53", "986") +
    formatTLV("54", amountStr) +
    formatTLV("58", "BR") +
    formatTLV("59", merchantName) +
    formatTLV("60", merchantCity) +
    formatTLV("62", additionalDataField) +
    "6304";

  return `${payloadWithoutCrc}${calculateCRC16(payloadWithoutCrc)}`;
}

/**
 * Valida e sanitiza os inputs antes de gerar o payload
 */
export function validatePixInput(input: Partial<PixPayloadInput>): {
  valid: boolean;
  error?: string;
} {
  if (!input.pixKeyType) {
    return { valid: false, error: "Tipo de chave Pix é obrigatório" };
  }

  if (!input.pixKey || input.pixKey.trim().length === 0) {
    return { valid: false, error: "Chave Pix é obrigatória" };
  }

  if (!isPixKeyValidByType(input.pixKeyType, input.pixKey)) {
    return { valid: false, error: "Chave Pix inválida para o tipo informado" };
  }

  if (!input.merchantName || input.merchantName.trim().length === 0) {
    return { valid: false, error: "Nome do recebedor é obrigatório" };
  }

  if (!input.merchantCity || input.merchantCity.trim().length === 0) {
    return { valid: false, error: "Cidade é obrigatória" };
  }

  if (typeof input.amountCents !== "number" || !Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { valid: false, error: "Valor deve ser maior que zero" };
  }

  return { valid: true };
}
