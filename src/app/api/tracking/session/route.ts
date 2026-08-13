import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

import { createClient } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/tracking/ip';
import { parseDevice } from '@/lib/tracking/device';
import { AUDIT_SESSION_COOKIE } from '@/lib/tracking/types';

// POST /api/tracking/session
// Called immediately after a successful login from the login page.
// Creates 2 audit records: AUTH.LOGIN_SUCCESS + SESSION.START (if not already tracked)
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

    // 1) Always log LOGIN_SUCCESS (idempotent is OK, admin can distinguish via timestamp)
    await supabase.rpc('create_audit_log', {
      p_event_type: 'AUTH',
      p_event_name: 'LOGIN_SUCCESS',
      ...common,
      p_metadata: { method: 'password' },
    });

    // 2) Log SESSION.START only if new session (prevents double-logging on refresh)
    if (isNewSession) {
      await supabase.rpc('create_audit_log', {
        p_event_type: 'SESSION',
        p_event_name: 'START',
        ...common,
      });
    }

    const response = NextResponse.json({
      success: true,
      session_id: sessionId,
      new_session: isNewSession,
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
