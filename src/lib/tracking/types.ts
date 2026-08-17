// Types for the simplified audit tracking system

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface DeviceInfo {
  device_type: DeviceType;
  operating_system: string | null;
  browser: string | null;
  user_agent: string | null;
}

// Information gathered from the client (browser) before/at login.
// Passed as JSON body to tracking APIs.
export interface ClientFingerprint {
  screen_resolution: string | null;   // e.g. "1920x1080"
  language: string | null;            // navigator.language, e.g. "ar-SA"
  timezone: string | null;            // Intl.DateTimeFormat timezone, e.g. "Asia/Riyadh"
  platform: string | null;            // navigator.platform, e.g. "Win32" (optional)
}

// Precise device geolocation obtained via the browser Geolocation API
// (navigator.geolocation.getCurrentPosition). Requires explicit user consent.
// This is MORE ACCURATE than the IP-based geolocation (city/block level vs
// country/city level). Since v005a this is a MANDATORY login precondition.
export interface BrowserGeoInfo {
  granted: boolean;                    // TRUE if user allowed the permission prompt
  latitude: number | null;             // Precise latitude (from GPS/WiFi triangulation)
  longitude: number | null;            // Precise longitude
  error_code?: number | null;          // GeolocationPositionError.code (if denied/error)
  error_message?: string | null;       // Human-readable error (if any)
}

// Geolocation information resolved from the client IP.
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
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  hotel_id: string | null;
  event_type: string;
  event_name: string;
  session_id: string | null;
  ip_address: string | null;
  device_type: string | null;
  operating_system: string | null;
  browser: string | null;
  user_agent: string | null;
  metadata: any;
  success: boolean;
  error_code: string | null;
  created_at: string;

  // 🌐 New — geolocation (if migration 005_SETUP_LOGIN_GEO_AUDIT is applied,
  // otherwise these are read from the `metadata` column fallback).
  geo_country_code?: string | null;
  geo_country_name?: string | null;
  geo_region?: string | null;
  geo_city?: string | null;
  geo_zip?: string | null;
  geo_lat?: number | null;
  geo_lon?: number | null;
  geo_isp?: string | null;
  geo_org?: string | null;
  geo_timezone?: string | null;

  // 🖥️ New — client-side extra fingerprint
  client_screen_res?: string | null;
  client_language?: string | null;
  client_timezone?: string | null;

  // ❌ New — attempted email for AUTH.LOGIN_FAILURE events
  attempted_email?: string | null;

  // 🛰️ New (v005a) — BROWSER PRECISE GEOLOCATION (MANDATORY login precondition)
  // Filled directly by `navigator.geolocation.getCurrentPosition` after the user
  // explicitly grants permission. More accurate than the IP-based columns above.
  browser_geo_lat?: number | null;
  browser_geo_lon?: number | null;
  browser_geo_granted?: boolean | null;
}

export const EVENT_TYPES = [
  'AUTH',
  'SESSION',
  'SECURITY',
  'USER',
  'BOOKING',
  'PAYMENT',
  'CONTRACT',
  'UNIT',
  'CLEANING',
  'MAINTENANCE',
  'SYSTEM',
] as const;

export const AUDIT_SESSION_COOKIE = 'audit_session_id';
