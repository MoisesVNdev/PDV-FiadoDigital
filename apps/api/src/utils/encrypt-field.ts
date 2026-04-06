import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;


/**
 * Criptografa uma string usando AES-256-GCM.
 * Retorna no formato base64: iv:authTag:ciphertext
 */
export function encryptField(plaintext: string, key: string): string {
  if (!plaintext) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, "hex"), iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Descriptografa uma string gerada pelo encryptField.
 * Se houver erro (chave inválida ou não criptografado), retorna o valor original (plaintext).
 */
export function decryptField(ciphertext: string, key: string): string {
  if (!ciphertext) return ciphertext;
  
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    return ciphertext; // Não está no formato `iv:authTag:ciphertext`
  }
  
  const [ivBase64, authTagBase64, encryptedBase64] = parts as [string, string, string];
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, "hex"), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedBase64, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    return ciphertext; // Retornar fallback para casos legados ou falhas inesperadas
  }
}
