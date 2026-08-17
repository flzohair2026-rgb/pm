import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

import { createClient } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/tracking/ip';
import { parseDevice } from '@/lib/tracking/device';
import { lookupGeoIp } from '@/lib/tracking/geoip';
import { AUDIT_SESSION_COOKIE, AuditLogMetadata, BrowserGeoCoords } from '@/lib/tracking/types';

// POST /api/tracking/session
// Called immediately after a successful login from the login page.
// Creates 2 audit records: AUTH.LOGIN_SUCCESS + SESSION.START (if not already tracked)
// + appends a rich geo-location record to metadata.location via ipwho.is (fail-soft)
// + enforces that browser W3C Geolocation (lat/lon) has been provided if the flag is set.
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 🟡 1) Parse browser body — for exact geolocation
    let browserGeo: BrowserGeoCoords | null = null;
    try {
      const body: any = await request.json().catch(() => ({}));
      const raw = body?.browser_geo as BrowserGeoCoords | null | undefined;
      if (raw && typeof raw.lat === 'number' && typeof raw.lon === 'number') {
        if (
          raw.lat >= -90 && raw.lat <= 90 &&
          raw.lon >= -180 && raw.lon <= 180 &&
          !(raw.lat === 0 && raw.lon === 0)
        ) {
          browserGeo = {
            lat: Number(raw.lat.toFixed(6)),
            lon: Number(raw.lon.toFixed(6)),
            accuracy_meters: typeof raw.accuracy_meters === 'number' ? Number(raw.accuracy_meters.toFixed(1)) : null,
            altitude_meters: typeof raw.altitude_meters === 'number' ? Number(raw.altitude_meters.toFixed(1)) : null,
            heading_deg: typeof raw.heading_deg === 'number' ? raw.heading_deg : null,
            speed_mps: typeof raw.speed_mps === 'number' ? raw.speed_mps : null,
            source: 'browser_w3c',
            granted_at: typeof raw.granted_at === 'string' ? raw.granted_at : new Date().toISOString(),
          };
        }
      }
    } catch {}

    const userAgent = request.headers.get('user-agent');
    const device = parseDevice(userAgent);
    const ip = getClientIp(request);

    // 🛑 MANDATORY CHECK — server-side enforcement of browser geolocation.
    // The UI blocks it early too, but this is the source of truth so user
    // can never bypass by rewriting the client-side JS.
    //
    // HOWEVER — W3C Geolocation works only on HTTPS or localhost.
    // When accessing over a LAN IP (http://192.168.x.y:3000) Chrome/Safari
    // silently disable the permission prompt, so every login fails without
    // user action. Detect private (RFC 1918) IPs automatically and skip
    // enforcement in that case, unless ENV FORCE explicitly asks for it.
    const isPrivateIp = (ipAddr: string | null): boolean => {
      if (!ipAddr) return true;
      if (ipAddr === '::1' || ipAddr === '127.0.0.1') return true;
      if (ipAddr.startsWith('10.')) return true;
      if (ipAddr.startsWith('192.168.')) return true;
      if (ipAddr.startsWith('127.')) return true;
      for (let i = 16; i <= 31; i++) {
        if (ipAddr.startsWith(`172.${i}.`)) return true;
      }
      return false;
    };
    const forceReq = (process.env.REQUIRE_BROWSER_GEO_FORCE as string | undefined) === 'true'
      || (process.env.NEXT_PUBLIC_REQUIRE_BROWSER_GEO_FORCE as string | undefined) === 'true';
    const disabledHard = (process.env.REQUIRE_BROWSER_GEO as string | undefined) === 'false'
      || (process.env.NEXT_PUBLIC_REQUIRE_BROWSER_GEO as string | undefined) === 'false';
    const comingFromPrivateLan = isPrivateIp(ip);
    const enforceGeo = !disabledHard && (forceReq || !comingFromPrivateLan);

    if (enforceGeo && !browserGeo) {
      // Immediately sign out the session because we refuse login without location.
      try {
        await supabase.auth.signOut().catch(() => {});
      } catch {}
      return NextResponse.json(
        {
          error: '❌ تم رفض الدخول من الخادم — فشل تحقق الموقع الجغرافي.',
          detail: comingFromPrivateLan
            ? 'يجب تعيين NEXT_PUBLIC_REQUIRE_BROWSER_GEO_FORCE=true لتشغيل الإلزامي على الشبكة المحلية، أو استخدم HTTPS / localhost.'
            : 'يجب السماح لتطبيق مساكن فندقية بالوصول إلى موقعك الدقيق قبل تسجيل الدخول.',
          requires_geo: true,
          coming_from_private_lan: comingFromPrivateLan,
        },
        { status: 403 }
      );
    }

    // const userAgent = ... (DELETED DUPLICATE)
    // const device = ...   (DELETED DUPLICATE)
    // const ip = ...       (DELETED DUPLICATE)

    // 🌐 IP geolocation lookup — fail-soft, never blocks
    let location: AuditLogMetadata['location'] = null;
    try {
      location = (await lookupGeoIp(ip)) || null;
    } catch {
      location = null;
    }

    // Merge IP location + exact browser geo coords
    const mergedLocation: AuditLogMetadata['location'] = location
      ? { ...location, browser_geo: browserGeo || undefined }
      : (browserGeo ? { browser_geo: browserGeo } : null);

    // Prevent duplicate SESSION_START per browser session
    let sessionId = cookieStore.get(AUDIT_SESSION_COOKIE)?.value ?? null;
    const isNewSession = !sessionId;

    if (isNewSession) {
      sessionId = randomUUID();
    }

    const common = {
      p_session_id: sessionId as any,
      p_ip_address: ip,
      p_device_type: device.device_type,
      p_operating_system: device.operating_system,
      p_browser: device.browser,
      p_user_agent: device.user_agent,
    };

    const baseMetadata: AuditLogMetadata = {
      method: 'password',
      ...(mergedLocation ? { location: mergedLocation } : {}),
    };

    // 1) Always log LOGIN_SUCCESS (idempotent is OK, admin can distinguish via timestamp)
    try {
      await supabase.rpc('create_audit_log', {
        p_event_type: 'AUTH',
        p_event_name: 'LOGIN_SUCCESS',
        ...common,
        p_metadata: baseMetadata,
      });
    } catch (rpcErr: any) {
      console.warn('[tracking/session] AUTH LOGIN_SUCCESS rpc failed:', rpcErr?.message || rpcErr);
    }

    // 2) Log SESSION.START only if new session (prevents double-logging on refresh)
    if (isNewSession) {
      try {
        await supabase.rpc('create_audit_log', {
          p_event_type: 'SESSION',
          p_event_name: 'START',
          ...common,
          p_metadata: mergedLocation ? { location: mergedLocation } : {},
        });
      } catch (rpcErr: any) {
        console.warn('[tracking/session] SESSION START rpc failed:', rpcErr?.message || rpcErr);
      }
    }

    const response = NextResponse.json({
      success: true,
      session_id: sessionId,
      new_session: isNewSession,
      location: mergedLocation || undefined,
      browser_geo: browserGeo || undefined,
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
