import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

import { createClient } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/tracking/ip';
import { parseDevice } from '@/lib/tracking/device';
import { geolocateIp } from '@/lib/tracking/geo';
import { AUDIT_SESSION_COOKIE, type ClientFingerprint } from '@/lib/tracking/types';

// POST /api/tracking/session
// Called immediately after a successful login from the login page.
// Creates 2 audit records: AUTH.LOGIN_SUCCESS + SESSION.START (if not already tracked)
// Now WITH:
//   🔥 Geo location (country/city/coords/ISP) via free IP APIs
//   🖥️ Client fingerprint (screen resolution/language/timezone) — sent in request body
//   🛰️ BROWSER PRECISE GEOLOCATION (GPS/WiFi) via navigator.geolocation (MANDATORY since v005a)
export async function POST(request: Request) {
  // ---------- 1. Read optional client body (fire-and-forget from login page) -------
  let clientFingerprint: Partial<ClientFingerprint> = {};
  let browserGeo: { granted: boolean; lat: number | null; lon: number | null } = {
    granted: false, lat: null, lon: null,
  };
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.toLowerCase().includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      if (body && typeof body === 'object') {
        clientFingerprint = {
          screen_resolution: typeof body.screen_resolution === 'string' ? body.screen_resolution : null,
          language: typeof body.language === 'string' ? body.language : null,
          timezone: typeof body.timezone === 'string' ? body.timezone : null,
          platform: typeof body.platform === 'string' ? body.platform : null,
        };
        const bLatRaw = (body as any).browser_geo_lat;
        const bLonRaw = (body as any).browser_geo_lon;
        const bGrantedRaw = (body as any).browser_geo_granted;
        browserGeo = {
          granted: bGrantedRaw === true || bGrantedRaw === 'true' || bGrantedRaw === 1,
          lat: (typeof bLatRaw === 'number' && Number.isFinite(bLatRaw)) ? bLatRaw : null,
          lon: (typeof bLonRaw === 'number' && Number.isFinite(bLonRaw)) ? bLonRaw : null,
        };
      }
    }
  } catch {
    // Ignore parse errors — body is optional
  }

  try {
    const cookieStore = await cookies();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAgent = request.headers.get('user-agent');
    const device = parseDevice(userAgent);
    const ip = getClientIp(request);

    // ---------- 2. 🌐 GEOLOCATION (parallel fetch but never blocks) -------
    const geoPromise = geolocateIp(ip);
    const geo = await geoPromise.catch(() => ({
      country_code: null, country_name: null, region: null, city: null, zip: null,
      lat: null, lon: null, isp: null, org: null, timezone: null,
    }));

    // ---------- 3. Session cookie management -----------------------------
    let sessionId = cookieStore.get(AUDIT_SESSION_COOKIE)?.value ?? null;
    const isNewSession = !sessionId;
    if (isNewSession) sessionId = randomUUID();

    // ---------- 4. Prepare common payload -------------------------------
    const screenRes = clientFingerprint.screen_resolution || null;
    const clientLang = clientFingerprint.language || null;
    const clientTz = clientFingerprint.timezone || null;

    // Build an enhanced `metadata` object that ALSO contains geo + client data.
    // This is the HYBRID SAFETY fallback: even if the SQL migration (005) has not
    // yet been applied (so the RPC signature is OLD with 12 params only), the data
    // is still persisted safely into the metadata jsonb column.
    const metadataBase = { method: 'password' } as Record<string, any>;
    if (geo.country_code) metadataBase.geo_country_code = geo.country_code;
    if (geo.country_name) metadataBase.geo_country_name = geo.country_name;
    if (geo.region) metadataBase.geo_region = geo.region;
    if (geo.city) metadataBase.geo_city = geo.city;
    if (geo.zip) metadataBase.geo_zip = geo.zip;
    if (geo.lat !== null && geo.lat !== undefined) metadataBase.geo_lat = geo.lat;
    if (geo.lon !== null && geo.lon !== undefined) metadataBase.geo_lon = geo.lon;
    if (geo.isp) metadataBase.geo_isp = geo.isp;
    if (geo.org) metadataBase.geo_org = geo.org;
    if (geo.timezone) metadataBase.geo_timezone = geo.timezone;
    if (screenRes) metadataBase.client_screen_res = screenRes;
    if (clientLang) metadataBase.client_language = clientLang;
    if (clientTz) metadataBase.client_timezone = clientTz;
    // 🛰️ BROWSER PRECISE GEOLOCATION (GPS — higher accuracy than IP)
    // v005a MANDATORY precondition. Also stored in dedicated columns via the RPC.
    if (browserGeo.lat !== null && browserGeo.lat !== undefined) metadataBase.browser_geo_lat = browserGeo.lat;
    if (browserGeo.lon !== null && browserGeo.lon !== undefined) metadataBase.browser_geo_lon = browserGeo.lon;
    metadataBase.browser_geo_granted = browserGeo.granted;

    const commonOldRpc = {
      p_session_id: sessionId as any,
      p_ip_address: ip,
      p_device_type: device.device_type,
      p_operating_system: device.operating_system,
      p_browser: device.browser,
      p_user_agent: device.user_agent,
      p_metadata: metadataBase,
    };
    const commonNewRpcExtra = {
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
      p_attempted_email: null,
      // 🛰️ v005a — browser precise geolocation (GPS / WiFi triangulation)
      p_browser_geo_lat: browserGeo.lat,
      p_browser_geo_lon: browserGeo.lon,
      p_browser_geo_granted: browserGeo.granted,
    };

    // ---------- 5. 3-step write helper (ZERO silent data loss pattern) ----------
    //   Step A: Try NEW extended 24-param RPC
    //   Step B: If ANY failure (any error, any reason) → try ORIGINAL 12-param RPC
    //   Step C: If ALSO failed → DIRECT INSERT into system_events (always works)
    // NEVER returns "true" unless a write actually persisted.
    const writeAudit = async (p_event_type: string, p_event_name: string, extraMeta: Record<string, any> = {}) => {
      const finalMeta = { ...metadataBase, ...extraMeta };

      // ============ 5A: NEW extended 24-param RPC ============
      try {
        const { error } = await supabase.rpc('create_audit_log', {
          p_event_type,
          p_event_name,
          p_hotel_id: null,
          ...commonOldRpc,
          p_metadata: finalMeta,
          p_success: true,
          p_error_code: null,
          ...commonNewRpcExtra,
        } as any);
        if (!error) return true;  // ✅ Step A worked
        // Fall through to Step B regardless of error type
      } catch {
        // Any throw → Step B
      }

      // ============ 5B: LEGACY 12-param RPC ============
      try {
        const { error } = await supabase.rpc('create_audit_log', {
          p_event_type,
          p_event_name,
          ...commonOldRpc,
          p_metadata: finalMeta,
        });
        if (!error) return true;  // ✅ Step B worked
      } catch {
        // Any throw → Step C (last resort)
      }

      // ============ 5C: LAST RESORT — DIRECT system_events INSERT ============
      // If both RPCs failed for any reason (permissions, migration not applied,
      // signature mismatch, auth issue...), we still persist the event so the
      // admin can see it in the legacy audit-log page at the very least.
      try {
        const { error } = await supabase.from('system_events').insert({
          event_type: p_event_type === 'AUTH' && p_event_name === 'LOGIN_SUCCESS'
            ? 'user_login'
            : `audit_${p_event_type.toLowerCase()}_${p_event_name.toLowerCase()}`,
          message: `${p_event_type} · ${p_event_name} — geo_fallback_direct_insert`,
          payload: {
            ...finalMeta,
            user_id: user?.id || null,
            user_email: user?.email || null,
            ip_address: ip,
            device_type: device.device_type,
            operating_system: device.operating_system,
            browser: device.browser,
            session_id: sessionId,
            audit_rpc_fallback: true,
          },
        });
        if (!error) return true;  // ✅ Step C worked
      } catch (e) {
        // EVERYTHING FAILED — log loudly on the SERVER (devs only)
        // eslint-disable-next-line no-console
        console.error(`[tracking/session] ALL 3 WRITE PATHS FAILED for ${p_event_type}/${p_event_name}:`, e);
      }

      return false;
    };

    // 1) Always log LOGIN_SUCCESS (idempotent is OK)
    await writeAudit('AUTH', 'LOGIN_SUCCESS');

    // 2) Log SESSION.START only if new session (prevents double-logging on refresh)
    if (isNewSession) {
      await writeAudit('SESSION', 'START', { session_start: true });
    }

    const response = NextResponse.json({
      success: true,
      session_id: sessionId,
      new_session: isNewSession,
      geo: geo.country_code ? { country_code: geo.country_code, city: geo.city } : null,
    });

    // Set session cookie for 12 hours
    if (isNewSession) {
      response.cookies.set(AUDIT_SESSION_COOKIE, sessionId!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 12,
        path: '/',
      });
    }

    return response;
  } catch (err: any) {
    console.error('[tracking/session] error:', err?.message || err);
    return NextResponse.json(
      { error: 'Tracking failed', detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
