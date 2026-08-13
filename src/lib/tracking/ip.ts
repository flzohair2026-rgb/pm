// Extracts the client IP address from request headers
// Uses the standard proxy headers — tries Cloudflare header first.

export function getClientIp(request: Request): string | null {
  const headers = request.headers;

  // 1. Cloudflare real connecting IP (most trusted if behind CF)
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp && isPlausibleIp(cfIp)) return cfIp.trim();

  // 2. Standard X-Forwarded-For (leftmost is the client)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first && isPlausibleIp(first)) return first;
  }

  // 3. X-Real-IP
  const realIp = headers.get('x-real-ip');
  if (realIp && isPlausibleIp(realIp)) return realIp.trim();

  return null;
}

// Light IP validation — prevents garbage strings.
// Final validation will be done by PostgreSQL inet cast inside the RPC.
function isPlausibleIp(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // IPv4 quick regex OR IPv6 containing colons
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v)) return true;
  if (v.includes(':') && v.length >= 3) return true;
  return false;
}
