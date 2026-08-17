import { GeoLocation } from './types';

const GEO_ENDPOINT = 'https://ipwho.is';
const REQUEST_TIMEOUT_MS = 3500;

/**
 * Server-side IP geolocation lookup.
 * - Fail-soft: returns null on any error (never throws).
 * - Private / reserved IP ranges (localhost, 192.168.x.x, 10.x.x.x) return
 *   a special "local_dev" marker that the UI can display friendly.
 */
export async function lookupGeoIp(ip: string | null): Promise<GeoLocation | null> {
  if (!ip) return null;

  if (isPrivateOrLocal(ip)) {
    return {
      country_code: 'LOCAL',
      country_name: 'تشغيل محلي / Dev',
      city: null,
      region: null,
      isp: 'Localhost',
      latitude: null,
      longitude: null,
      timezone: null,
      flag_emoji: '🧪',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const url = `${GEO_ENDPOINT}/${encodeURIComponent(ip)}?fields=country_code,country_name,city,region,isp,latitude,longitude,timezone,flag`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body || body?.success === false) return null;

    return {
      country_code: body?.country_code || null,
      country_name: body?.country_name || null,
      city: body?.city || null,
      region: body?.region || null,
      isp: body?.isp || null,
      latitude: typeof body?.latitude === 'number' ? body.latitude : null,
      longitude: typeof body?.longitude === 'number' ? body.longitude : null,
      timezone: body?.timezone?.id || body?.timezone || null,
      flag_emoji: body?.flag?.emoji || countryCodeToFlag(body?.country_code),
    };
  } catch (e) {
    return null;
  }
}

/**
 * Lightweight private / reserved IP detection.
 */
function isPrivateOrLocal(ip: string): boolean {
  const v = ip.trim();
  if (!v) return false;
  if (v === '::1' || v === '0.0.0.0' || v.toLowerCase() === 'localhost') return true;
  if (v.startsWith('127.') || v.startsWith('10.') || v.startsWith('192.168.')) return true;
  if (v.startsWith('169.254.') || v.startsWith('172.16.') || v.startsWith('172.17.') ||
      v.startsWith('172.18.') || v.startsWith('172.19.') || v.startsWith('172.2') ||
      v.startsWith('172.30.') || v.startsWith('172.31.')) return true;
  return false;
}

/**
 * Convert ISO-3166-1 alpha-2 country code → flag emoji (fallback).
 */
export function countryCodeToFlag(code: string | null | undefined): string {
  if (!code) return '🌐';
  if (code.toUpperCase() === 'LOCAL') return '🧪';
  const c = code.toUpperCase();
  if (c.length !== 2) return '🌐';
  const codePoints = [...c].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65);
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌐';
  }
}
