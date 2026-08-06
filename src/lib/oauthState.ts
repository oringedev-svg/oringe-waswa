import crypto from 'crypto'

// The `state` parameter is the only thing standing between an OAuth callback
// and a forged one, so it is signed rather than merely random: the callback
// can then prove the value it received is one this server issued, for this
// person, without keeping server-side session state between the two requests.

function secret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'oringe-oauth-state'
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function signOAuthState(profileId: string): string {
  const payload = `${profileId}.${Date.now()}.${crypto.randomBytes(8).toString('base64url')}`
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`
}

/**
 * Returns the profile id the state was issued for, or null if the value was
 * tampered with, malformed, or older than 15 minutes.
 */
export function verifyOAuthState(state: string | null): string | null {
  if (!state) return null

  const [encoded, signature] = state.split('.')
  if (!encoded || !signature) return null

  let payload: string
  try {
    payload = Buffer.from(encoded, 'base64url').toString()
  } catch {
    return null
  }

  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  const [profileId, issuedAt] = payload.split('.')
  if (!profileId || !issuedAt) return null
  if (Date.now() - Number(issuedAt) > 15 * 60 * 1000) return null

  return profileId
}
