// Show fixed, safe explanations; never render raw OAuth error text or tokens.
export function loginErrorMessage(search: string, hash = ''): string | null {
  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  const value = (key: string) => query.get(key) || fragment.get(key) || ''
  const code = value('error_code') || value('error')
  if (['user_banned', 'account_disabled'].includes(code) || /\b(banned|disabled)\b/i.test(value('error_description'))) {
    return 'Sign-in is disabled for this account. Please contact Gabriel to restore access.'
  }
  if (code === 'no_email') return 'Google did not provide a verified email address. Please try your company account.'
  if (code === 'access_denied') return 'Google sign-in was not completed. Please try again with your company account.'
  if (code || value('error_description')) return 'We couldn’t complete your sign-in. Please try again. If this continues, contact Gabriel.'
  return null
}
