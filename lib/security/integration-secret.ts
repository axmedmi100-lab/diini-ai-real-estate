import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const encoded = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("INTEGRATION_ENCRYPTION_KEY is missing.");

  // Support the two standard ways a 32-byte key is commonly generated:
  // 64 hexadecimal characters or base64. This also makes key rotation less
  // error-prone across hosting dashboards that do not label the encoding.
  if (/^[0-9a-f]{64}$/i.test(encoded)) return Buffer.from(encoded, "hex");

  const base64Key = Buffer.from(encoded, "base64");
  if (base64Key.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be 64 hex characters or base64 decoding to 32 bytes.");
  }
  return base64Key;
}

export function encryptIntegrationSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptIntegrationSecret(payload: string) {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted integration secret.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

