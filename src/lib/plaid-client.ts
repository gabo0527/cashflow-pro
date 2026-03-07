// src/lib/plaid-client.ts
// Plaid SDK wrapper with AES-256-GCM encryption for access tokens

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_HEX   = process.env.PLAID_ENCRYPTION_KEY!

function getKey(): Buffer {
  if (!KEY_HEX) throw new Error('PLAID_ENCRYPTION_KEY not set')
  return Buffer.from(KEY_HEX, 'hex')
}

// ── Encryption ──────────────────────────────────────────────────────────────

export function encryptToken(plaintext: string): string {
  const iv         = crypto.randomBytes(12)
  const cipher     = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag    = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':')
  const iv       = Buffer.from(ivHex,  'hex')
  const authTag  = Buffer.from(tagHex, 'hex')
  const data     = Buffer.from(dataHex,'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// ── Plaid client ─────────────────────────────────────────────────────────────

function getPlaidClient(): PlaidApi {
  const env = process.env.PLAID_ENV || 'sandbox'
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env as keyof typeof PlaidEnvironments],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
        'PLAID-SECRET':    process.env.PLAID_SECRET!,
      },
    },
  })
  return new PlaidApi(configuration)
}

export const plaidClient = getPlaidClient()

// ── Account mapping ───────────────────────────────────────────────────────────
// Maps Plaid account IDs → our internal account IDs + cardholder

export interface PlaidAccountMapping {
  plaidAccountId: string
  internalAccountId: string  // 'checking_7801' | 'bofa_cc_gabriel' | etc.
  cardholder?: string
  institution: 'firstbank' | 'bofa'
}

// ── Token helpers ─────────────────────────────────────────────────────────────

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function getPlaidTokens(companyId: string): Promise<{
  firstbank?: string
  bofa?: string
  accountMappings?: PlaidAccountMapping[]
} | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data, error } = await supabase
    .from('company_settings')
    .select('plaid_token_firstbank_enc, plaid_token_bofa_enc, plaid_account_mappings')
    .eq('company_id', companyId)
    .single()

  if (error || !data) return null

  return {
    firstbank: data.plaid_token_firstbank_enc ? decryptToken(data.plaid_token_firstbank_enc) : undefined,
    bofa:      data.plaid_token_bofa_enc      ? decryptToken(data.plaid_token_bofa_enc)      : undefined,
    accountMappings: data.plaid_account_mappings || [],
  }
}

// ── Link token creation ───────────────────────────────────────────────────────

export async function createLinkToken(companyId: string, institution: 'firstbank' | 'bofa') {
  const response = await plaidClient.linkTokenCreate({
    user:         { client_user_id: `${companyId}-${institution}` },
    client_name:  'VantageFP',
    products:     [Products.Transactions],
    country_codes:[CountryCode.Us],
    language:     'en',
  })
  return response.data.link_token
}

// ── Exchange public token ─────────────────────────────────────────────────────

export async function exchangePublicToken(publicToken: string): Promise<{
  accessToken: string
  itemId: string
}> {
  const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken })
  return {
    accessToken: response.data.access_token,
    itemId:      response.data.item_id,
  }
}

// ── Fetch transactions ────────────────────────────────────────────────────────

export interface PlaidTransaction {
  plaid_transaction_id: string
  date: string
  description: string
  amount: number          // Plaid: positive = debit (money out), we invert
  payee: string
  plaid_account_id: string
  pending: boolean
  category: string[]
}

export async function fetchTransactions(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<PlaidTransaction[]> {
  const response = await plaidClient.transactionsGet({
    access_token: accessToken,
    start_date:   startDate,
    end_date:     endDate,
    options:      { count: 500, offset: 0, include_personal_finance_category: true },
  })

  let transactions = response.data.transactions
  const total      = response.data.total_transactions

  // Paginate if needed
  while (transactions.length < total) {
    const more = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date:   startDate,
      end_date:     endDate,
      options:      { count: 500, offset: transactions.length },
    })
    transactions = [...transactions, ...more.data.transactions]
  }

  return transactions.map(t => ({
    plaid_transaction_id: t.transaction_id,
    date:                 t.date,
    description:          t.name,
    // Plaid positive = money leaving account (debit), we store as negative
    amount:               -(t.amount),
    payee:                t.merchant_name || t.name,
    plaid_account_id:     t.account_id,
    pending:              t.pending,
    category:             t.category || [],
  }))
}
