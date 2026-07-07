// src/lib/field-crypto.ts
// Field-level encryption for sensitive onboarding data (tax IDs, bank details).
// Independent of QBO. Requires FIELD_ENCRYPTION_KEY (32-byte base64) in env.

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.FIELD_ENCRYPTION_KEY
  if (!key) {
    throw new Error('FIELD_ENCRYPTION_KEY environment variable is required')
  }
  return Buffer.from(key, 'base64')
}

// Encrypt a single value. Empty/undefined -> '' (nothing stored).
export function encryptField(plainText: string | null | undefined): string {
  if (plainText == null || plainText === '') return ''
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(String(plainText), 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]).toString('base64')
}

// Decrypt a value. Empty -> ''.
export function decryptField(encryptedData: string | null | undefined): string {
  if (!encryptedData) return ''
  const key = getKey()
  const combined = Buffer.from(encryptedData, 'base64')
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// Mask for UI + audit logs: "••••4419". Never logs full secrets.
export function maskValue(plainText: string | null | undefined, visible = 4): string {
  if (!plainText) return ''
  const s = String(plainText)
  if (s.length <= visible) return '••••'
  return '••••' + s.slice(-visible)
}

// Run once to create the key, then set FIELD_ENCRYPTION_KEY in Vercel.
export function generateFieldKey(): string {
  return crypto.randomBytes(32).toString('base64')
}
