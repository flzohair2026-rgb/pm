import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/tracking/ip';
import { parseDevice } from '@/lib/tracking/device';
import { geolocateIp } from '@/lib/tracking/geo';
import { AUDIT_SESSION_COOKIE } from '@/lib/tracking/types';

// POST /api/tracking/logout
// Called from UserMenu BEFORE the actual supabase.auth.signOut()
// so we still have access to auth.uid() + auth session cookies.
//
// ZERO SILENT DATA LOSS pattern (3 steps, identical to /api/tracking/session):
//   Step A: NEW 24-param create_audit_log RPC
//   Step B: LEGACY 12-param create_audit_log RPC
//   Step C: DIRECT system_events INSERT
export async function POST(request: Request) {
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

    // 🌐 GEOLOCATION (parallel, never blocks)
    const geo = await geolocateIp(ip).catch(() => ({
      country_code: null, country_name: null, region: null, city: null, zip: null,
      lat: null, lon: null, isp: null, org: null, timezone: null,
    }));

    // Optional client fingerprint from body (fire-and-forget from client)
    let screenRes: string | null = null;
    let clientLang: string | null = null;
    let clientTz: string | null = null;
    // 🛰️ BROWSER PRECISE GEOLOCATION (v005a)
    // Typically captured at LOGIN, but we also accept it at LOGOUT if the
    // client re-sends it (or retrieves from sessionStorage). If null, the
    // event is still fully correlated with LOGIN_SUCCESS by session_id.
    let browserGeo: { granted: boolean; lat: number | null; lon: number | null } = {
      granted: false, lat: null, lon: null,
    };
    try {
      const ct = request.headers.get('content-type') || '';
      if (ct.toLowerCase().includes('application/json')) {
        const body = await request.json().catch(() => ({} as any));
        if (body && typeof body === 'object') {
          screenRes = typeof body.screen_resolution === 'string' ? body.screen_resolution : null;
          clientLang = typeof body.language === 'string' ? body.language : null;
          clientTz = typeof body.timezone === 'string' ? body.timezone : null;
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
      // body is optional
    }

    // Session ID (if exists — so we can correlate SESSION.END → SESSION.START)
    const sessionId = cookieStore.get(AUDIT_SESSION_COOKIE)?.value ?? null;

    // ---- Build metadata + common payload (HYBRID fallback) ----
    const metadataBase: Record<string, any> = { method: 'logout', session_end: true };
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
    // 🛰️ BROWSER PRECISE GEOLOCATION (v005a)
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
      // 🛰️ v005a — BROWSER PRECISE GEOLOCATION
      p_browser_geo_lat: browserGeo.lat,
      p_browser_geo_lon: browserGeo.lon,
      p_browser_geo_granted: browserGeo.granted,
    };

    // ---- 3-step ZERO silent loss writer ----
    const writeAudit = async (p_event_type: string, p_event_name: string, success: boolean, extraMeta: Record<string, any> = {}) => {
      const finalMeta = { ...metadataBase, ...extraMeta };

      // Step A: NEW 24-param RPC
      try {
        const { error } = await supabase.rpc('create_audit_log', {
          p_event_type,
          p_event_name,
          p_hotel_id: null,
          ...commonOldRpc,
          p_metadata: finalMeta,
          p_success: success,
          p_error_code: null,
          ...commonNewRpcExtra,
        } as any);
        if (!error) return true;
      } catch {
        // fallthrough
      }

      // Step B: LEGACY 12-param RPC
      try {
        const { error } = await supabase.rpc('create_audit_log', {
          p_event_type,
          p_event_name,
          ...commonOldRpc,
          p_metadata: finalMeta,
        });
        if (!error) return true;
      } catch {
        // fallthrough
      }

      // Step C: DIRECT system_events INSERT
      try {
        const { error } = await supabase.from('system_events').insert({
          event_type: p_event_name === 'LOGOUT_SUCCESS' ? 'user_logout' : `audit_${p_event_type.toLowerCase()}_${p_event_name.toLowerCase()}`,
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
        if (!error) return true;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[tracking/logout] ALL 3 WRITE PATHS FAILED for ${p_event_type}/${p_event_name}:`, e);
      }
      return false;
    };

    // Write 2 correlated events (both use the SAME session_id for correlation)
    const [r1] = await Promise.all([
      writeAudit('AUTH', 'LOGOUT_SUCCESS', true),
    ]);
    // SESSION.END as a separate second step (correlated by session_id)
    if (sessionId) {
      await writeAudit('SESSION', 'END', true, { session_end: true });
    }

    // Clear the audit session cookie
    const response = NextResponse.json({
      success: true,
      wrote_r1: r1,
      session_id: sessionId,
    });
    response.cookies.set(AUDIT_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('[tracking/logout] error:', err?.message || err);
    return NextResponse.json(
      { error: 'Tracking failed', detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
