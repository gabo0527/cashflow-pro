// ============================================================
// ADMIN ALLOWLIST
// ============================================================
// Emails listed here are allowed to access the main Vantage
// admin platform. Anyone else who tries to log in via Google
// SSO will be redirected to /contractor-portal.
//
// To add an admin: add their email (lowercase) to the array
// below, then commit. Vercel auto-deploys.
//
// To remove an admin: delete their email from the array and
// commit. They will be signed out on their next request.
//
// Emails must EXACTLY match the email Google returns from SSO.
// Always lowercase, no whitespace.
// ============================================================

export const ADMIN_EMAILS: ReadonlyArray<string> = [
  'gabriel@manocg.com',
  // Add Kathia + Rodrigo here when ready, e.g.:
  // 'kathia@manocg.com',
  // 'rodrigo@manocg.com',
]

/**
 * Returns true if the given email is in the admin allowlist.
 * Comparison is case-insensitive and whitespace-tolerant.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.toLowerCase().trim()
  return ADMIN_EMAILS.includes(normalized)
}
