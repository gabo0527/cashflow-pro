// Save as: src/lib/qbo-encryption.ts

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.QBO_ENCRYPTION_KEY
  if (!key) {
    throw new Error('QBO_ENCRYPTION_KEY environment variable is required')
  }
  // Key should be 32 bytes (256 bits) base64 encoded
  return Buffer.from(key, 'base64')
}

export function encryptToken(plainText: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plainText, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  
  const authTag = cipher.getAuthTag()
  
  // Combine IV + AuthTag + Encrypted data, all base64 encoded
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64')
  ])
  
  return combined.toString('base64')
}

export function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')
  
  // Extract IV, AuthTag, and encrypted content
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// Utility to generate a new encryption key (run once, save to env)
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64')
}
