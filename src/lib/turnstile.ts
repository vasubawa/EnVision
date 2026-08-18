export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return false

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      signal: controller.signal,
    })
    const data = await res.json()
    return data.success === true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Turnstile verification failed', err)
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}
