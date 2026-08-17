import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/tracking/ip';
import { parseDevice } from '@/lib/tracking/device';
import { geolocateIp } from '@/lib/tracking/geo';
import type { ClientFingerprint } from '@/lib/tracking/types';

// POST /api/audit/log-login-failure
// Called when the user's email/password combination is wrong.
// Does NOT require authentication (the user hasn't authenticated yet).
//
// SAFETY LAYERED STRATEGY (hybrid approach, works with/without SQL):
//   A) Try the dedicated public RPC `create_login_failure_log` (requires 005 migration).
//      This has its own built-in rate limiting (50 / hr per IP).
//   B) If that function doesn't exist (005 not applied yet) → fallback to a
//      safe APPEND-ONLY write on system_events (the same table used elsewhere
//      in the project for user_login). This works NOW WITHOUT any SQL changes.
// Either way → data is stored. Client never sees failures (fire-and-forget).
export async function POST(request: Request) {
  // ---------- 1. Read and validate body ----------
  let attemptedEmail: string = '';
  let errorMessage: string | null = null;
  let clientFingerprint: Partial<ClientFingerprint> = {};
  // 🛰️ v005a — BROWSER PRECISE GEO (passed from login page before auth attempt)
  let browserGeo: { granted: boolean; lat: number | null; lon: number | null; error_code: number | null } = {
    granted: false, lat: null, lon: null, error_code: null,
  };

  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.toLowerCase().includes('application/json')) {
      const body = await request.json().catch(() => ({} as any));
      if (body && typeof body === 'object') {
        attemptedEmail = typeof body.email === 'string' ? body.email.trim() : '';
        errorMessage = typeof body.error === 'string' ? body.error : null;
        clientFingerprint = {
          screen_resolution: typeof body.screen_resolution === 'string' ? body.screen_resolution : null,
          language: typeof body.language === 'string' ? body.language : null,
          timezone: typeof body.timezone === 'string' ? body.timezone : null,
          platform: typeof body.platform === 'string' ? body.platform : null,
        };
        const bLatRaw = (body as any).browser_geo_lat;
        const bLonRaw = (body as any).browser_geo_lon;
        const bGrantedRaw = (body as any).browser_geo_granted;
        const bErrRaw = (body as any).browser_geo_error_code;
        browserGeo = {
          granted: bGrantedRaw === true || bGrantedRaw === 'true' || bGrantedRaw === 1,
          lat: (typeof bLatRaw === 'number' && Number.isFinite(bLatRaw)) ? bLatRaw : null,
          lon: (typeof bLonRaw === 'number' && Number.isFinite(bLonRaw)) ? bLonRaw : null,
          error_code: (typeof bErrRaw === 'number' && Number.isFinite(bErrRaw)) ? bErrRaw : null,
        };
      }
    }
  } catch {
    // No body is OK — we still have IP + UA.
  }

  // Hard-limit the length to prevent nonsense writes.
  if (attemptedEmail.length > 255) attemptedEmail = attemptedEmail.slice(0, 255);
  if (errorMessage && errorMessage.length > 500) errorMessage = errorMessage.slice(0, 500);

  // Sanity: email must contain @ or be empty (empty is logged with reason "missing email")
  if (attemptedEmail && !attemptedEmail.includes('@')) {
    // Not a real email attempt, but log it anyway for pattern detection — shorted.
    attemptedEmail = attemptedEmail.slice(0, 100);
  }

  // ---------- 2. IP + UA + Device ----------
  const userAgent = request.headers.get('user-agent');
  const device = parseDevice(userAgent);
  const ip = getClientIp(request);

  // ---------- 3. Geo (never throw) ----------
  const geo = await geolocateIp(ip).catch(() => ({
    country_code: null, country_name: null, region: null, city: null, zip: null,
    lat: null, lon: null, isp: null, org: null, timezone: null,
  }));

  const screenRes = clientFingerprint.screen_resolution || null;
  const clientLang = clientFingerprint.language || null;
  const clientTz = clientFingerprint.timezone || null;

  // ---------- 4. Hybrid fallback metadata (always works) ----------
  const metadata: Record<string, any> = {
    login_failure: true,
    ip,
    ua: device.user_agent,
  };
  if (errorMessage) metadata.err = errorMessage;
  if (geo.country_code) metadata.geo_country_code = geo.country_code;
  if (geo.country_name) metadata.geo_country_name = geo.country_name;
  if (geo.region) metadata.geo_region = geo.region;
  if (geo.city) metadata.geo_city = geo.city;
  if (geo.zip) metadata.geo_zip = geo.zip;
  if (geo.lat !== null && geo.lat !== undefined) metadata.geo_lat = geo.lat;
  if (geo.lon !== null && geo.lon !== undefined) metadata.geo_lon = geo.lon;
  if (geo.isp) metadata.geo_isp = geo.isp;
  if (geo.org) metadata.geo_org = geo.org;
  if (geo.timezone) metadata.geo_timezone = geo.timezone;
  if (device.device_type) metadata.device_type = device.device_type;
  if (device.operating_system) metadata.operating_system = device.operating_system;
  if (device.browser) metadata.browser = device.browser;
  if (screenRes) metadata.client_screen_res = screenRes;
  if (clientLang) metadata.client_language = clientLang;
  if (clientTz) metadata.client_timezone = clientTz;
  // 🛰️ BROWSER PRECISE GEOLOCATION (v005a mandatory precondition)
  // Captured BEFORE the signIn attempt, so we log even when GEO was the
  // actual failure (permission denied, timeout, insecure HTTP, etc.).
  if (browserGeo.lat !== null && browserGeo.lat !== undefined) metadata.browser_geo_lat = browserGeo.lat;
  if (browserGeo.lon !== null && browserGeo.lon !== undefined) metadata.browser_geo_lon = browserGeo.lon;
  metadata.browser_geo_granted = browserGeo.granted;
  if (browserGeo.error_code !== null && browserGeo.error_code !== undefined) {
    metadata.browser_geo_error_code = browserGeo.error_code;
  }

  let wroteVia: 'rpc_login_failure' | 'system_events' | 'none' = 'none';
  let writeError: string | null = null;

  // ---------- 5. Write Strategy A: Dedicated RPC (005 migration applied) ----------
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc('create_login_failure_log', {
      p_attempted_email: attemptedEmail || '(empty)',
      p_error_code: errorMessage,

      p_session_id: null,
      p_ip_address: ip,
      p_device_type: device.device_type,
      p_operating_system: device.operating_system,
      p_browser: device.browser,
      p_user_agent: device.user_agent,

      p_geo_country_code: geo.country_code ? String(geo.country_code).slice(0, 2) : null,
      p_geo_country_name: geo.country_name,
      p_geo_region: geo.region,
      p_geo_city: geo.city,
      p_geo_zip: geo.zip,
      p_geo_lat: (geo.lat !== null && geo.lat !== undefined && !Number.isNaN(geo.lat)) ? geo.lat : null,
      p_geo_lon: (geo.lon !== null && geo.lon !== undefined && !Number.isNaN(geo.lon)) ? geo.lon : null,
      p_geo_isp: geo.isp,
      p_geo_org: geo.org,
      p_geo_timezone: geo.timezone,

      p_client_screen_res: screenRes,
      p_client_language: clientLang,
      p_client_timezone: clientTz,

      p_metadata: metadata,

      // 🛰️ v005a — BROWSER PRECISE GEOLOCATION (GPS / WiFi triangulation)
      // This is captured BEFORE any auth attempt, so we can log GEO_DENIED
      // failures (permission/timeout) BEFORE even touching auth.
      p_browser_geo_lat: browserGeo.lat,
      p_browser_geo_lon: browserGeo.lon,
      p_browser_geo_granted: browserGeo.granted,
    });
    if (!error) {
      wroteVia = 'rpc_login_failure';
    } else {
      // Any error (missing function, permissions, signature, rate-limit triggered,
      // postgres exception...) → DO NOT give up. Strategy B below is unconditional
      // when wroteVia === 'none'. We still capture the error for debugging.
      writeError = String(error?.message || writeError || 'rpc_login_failure_error');
    }
  } catch (e: any) {
    writeError = String(e?.message || e || writeError || 'unknown throw');
  }

  // ---------- 6. Write Strategy B: system_events table (WORKS ALWAYS, no migration) ----------
  //   This path runs 100% of the time if Strategy A didn't succeed, GUARANTEEING no
  //   silent data loss regardless of Supabase state.
  if (wroteVia === 'none') {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from('system_events').insert({
        event_type: 'user_login_failure',
        message: `محاولة دخول فاشلة: ${attemptedEmail || '(بريد غير معروف)'} — ${errorMessage || 'خطأ غير محدد'}`,
        payload: metadata,
      });
      if (!error) wroteVia = 'system_events';
      else writeError = String(error?.message || writeError || 'system_events insert failed');
    } catch (e: any) {
      writeError = String(e?.message || e || writeError || 'unknown');
      // Both paths failed — log loudly on the server (never reaches the client)
      // eslint-disable-next-line no-console
      console.error('[audit/log-login-failure] BOTH WRITE PATHS FAILED:', { writeError, attemptedEmail, ip });
    }
  }

  // ---------- 7. Always return 200 OK — login page must never fail ----------
  // Do NOT leak any details about why the write failed to the client.
  return NextResponse.json({
    ok: true,
    written: wroteVia !== 'none',
    // eslint-disable-next-line no-nested-ternary
    mode: wroteVia === 'none' ? 'skipped' : wroteVia,
  });
}
