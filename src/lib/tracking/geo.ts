// Geolocation lookup — zero dependencies.
// Uses free public APIs that don't require an API key.
// Order of fallback: ipwho.is (primary, unlimited free) → ipapi.co (secondary).
// All results are safely cached for 1 hour to avoid redundant lookups.
// If ALL APIs fail → returns a default empty object (never throws).

export interface GeoLocationInfo {
  country_code: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
  isp: string | null;
  org: string | null;
  timezone: string | null;
  raw?: any;
}

const cache = new Map<string, { data: GeoLocationInfo; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const EMPTY: GeoLocationInfo = {
  country_code: null,
  country_name: null,
  region: null,
  city: null,
  zip: null,
  lat: null,
  lon: null,
  isp: null,
  org: null,
  timezone: null,
};

function isPrivateIp(ip: string | null): boolean {
  if (!ip) return true;
  const t = ip.trim();
  return (
    t === '' ||
    t.startsWith('10.') ||
    t.startsWith('192.168.') ||
    t.startsWith('172.16.') ||
    t.startsWith('172.17.') ||
    t.startsWith('172.18.') ||
    t.startsWith('172.19.') ||
    t.startsWith('172.2') ||
    t.startsWith('172.30.') ||
    t.startsWith('172.31.') ||
    t === '127.0.0.1' ||
    t === '::1' ||
    t.startsWith('localhost') ||
    t.includes(':') && t.startsWith('fe80')
  );
}

async function lookupIpwhois(ip: string): Promise<GeoLocationInfo | null> {
  try {
    const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || j.success === false) return null;
    return {
      country_code: (String(j.country_code || '') || '').toUpperCase() || null,
      country_name: String(j.country || '') || null,
      region: String(j.region || '') || null,
      city: String(j.city || '') || null,
      zip: String(j.postal || j.zip || '') || null,
      lat: typeof j.latitude === 'number' ? j.latitude : (parseFloat(j.latitude) || null),
      lon: typeof j.longitude === 'number' ? j.longitude : (parseFloat(j.longitude) || null),
      isp: String(j.connection?.isp || j.isp || '') || null,
      org: String(j.connection?.org || j.org || '') || null,
      timezone: String(j.timezone?.id || j.timezone || '') || null,
      raw: j,
    };
  } catch {
    return null;
  }
}

async function lookupIpapi(ip: string): Promise<GeoLocationInfo | null> {
  try {
    const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || j.error) return null;
    return {
      country_code: (String(j.country_code || '') || '').toUpperCase() || null,
      country_name: String(j.country_name || j.country || '') || null,
      region: String(j.region || '') || null,
      city: String(j.city || '') || null,
      zip: String(j.postal || j.zip || '') || null,
      lat: typeof j.latitude === 'number' ? j.latitude : (parseFloat(j.latitude) || null),
      lon: typeof j.longitude === 'number' ? j.longitude : (parseFloat(j.longitude) || null),
      isp: String(j.org || j.isp || '') || null,
      org: String(j.org || '') || null,
      timezone: String(j.timezone || '') || null,
      raw: j,
    };
  } catch {
    return null;
  }
}

export async function geolocateIp(ip: string | null | undefined): Promise<GeoLocationInfo> {
  if (!ip) return { ...EMPTY };
  const t = ip.trim();
  if (!t || isPrivateIp(t)) return { ...EMPTY };

  // Cache hit
  const now = Date.now();
  const cached = cache.get(t);
  if (cached && cached.expiresAt > now) {
    return { ...cached.data };
  }

  // Fallback chain
  let result: GeoLocationInfo | null = null;
  result = await lookupIpwhois(t);
  if (!result) result = await lookupIpapi(t);
  const finalResult = result || { ...EMPTY };

  // Save to cache
  cache.set(t, { data: finalResult, expiresAt: now + CACHE_TTL_MS });

  return { ...finalResult };
}

// Convert country code to regional flag emoji (works on all modern browsers/OSes).
// If the country code is invalid or not provided, returns a small fallback globe emoji.
export function countryFlagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode) return '🌐';
  const code = countryCode.trim().toUpperCase();
  if (code.length !== 2) return '🌐';
  // Special case: allow well-known invalid codes to gracefully fall back
  try {
    const codePoints = code
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌐';
  }
}

// Return a Google Maps link for coordinates (opens the location in maps).
export function googleMapsLink(lat: number | null | undefined, lon: number | null | undefined): string | null {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return `https://www.google.com/maps?q=${lat},${lon}&z=11`;
}
