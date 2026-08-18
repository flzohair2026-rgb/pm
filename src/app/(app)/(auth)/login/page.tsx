"use client";

import { Suspense, useState } from "react";
import { Lock, Mail, Eye, EyeOff, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import type { BrowserGeoInfo, ClientFingerprint } from "@/lib/tracking/types";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [geoRequesting, setGeoRequesting] = useState(false);
  const banned = searchParams.get('banned') === '1';

  // 🖥️ Helper: captures lightweight device fingerprint from the browser
  // (screen resolution, user language, timezone, platform).
  // NEVER blocks and ALWAYS returns safe defaults.
  const captureFingerprint = (): ClientFingerprint => {
    try {
      if (typeof window === 'undefined') {
        return { screen_resolution: null, language: null, timezone: null, platform: null };
      }
      const w = window as any;
      const s = w.screen || {};
      const tz = (w.Intl && typeof w.Intl.DateTimeFormat === 'function' && typeof w.Intl.DateTimeFormat().resolvedOptions === 'function')
        ? w.Intl.DateTimeFormat().resolvedOptions().timeZone
        : null;
      return {
        screen_resolution: (typeof s.width === 'number' && typeof s.height === 'number')
          ? `${s.width}x${s.height}`
          : null,
        language: (typeof w.navigator !== 'undefined' && w.navigator.language) || null,
        timezone: tz || null,
        platform: (typeof w.navigator !== 'undefined' && w.navigator.platform) || null,
      };
    } catch {
      return { screen_resolution: null, language: null, timezone: null, platform: null };
    }
  };

  // ============================================================
  // 🛰️ OPTIONAL (v005b): request the browser's Precise Geolocation API
  //   — If the user allows: we log the precise browser GPS coords
  //     alongside the IP-based fallback for better audit trail.
  //   — If the user DENIES or it fails: login is STILL allowed.
  //     We just record geo as "not granted" and pass null coords.
  //   Triggered ONLY when the user clicks "دخول للنظام" (not on page load).
  // ============================================================
  const requestBrowserGeoLocation = (): Promise<BrowserGeoInfo> => {
    return new Promise((resolve) => {
      // Safety: if this runs in a non-browser context or geolocation is
      // unavailable (e.g. insecure HTTP outside localhost) → fail softly
      // with a clear, user-actionable message.
      if (typeof window === 'undefined' ||
          typeof (window as any).navigator === 'undefined' ||
          !(window as any).navigator.geolocation ||
          typeof (window as any).navigator.geolocation.getCurrentPosition !== 'function') {
        resolve({
          granted: false,
          latitude: null,
          longitude: null,
          error_code: 99,
          error_message:
            (typeof window !== 'undefined' && window.location && window.location.protocol !== 'https:' && !(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
              ? 'GEO_INSECURE_CONTEXT_HTTPS_REQUIRED'
              : 'GEO_UNAVAILABLE_NO_BROWSER_SUPPORT',
        });
        return;
      }

      const navGeo = (window as any).navigator.geolocation;
      let settled = false;
      const safeResolve = (val: BrowserGeoInfo) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };

      // 10-second hard timeout (user must respond to prompt or GPS must return)
      const timeoutTimer = setTimeout(() => {
        safeResolve({
          granted: false,
          latitude: null,
          longitude: null,
          error_code: 3,
          error_message: 'GEO_TIMEOUT_USER_DID_NOT_RESPOND',
        });
      }, 10000);

      try {
        navGeo.getCurrentPosition(
          (pos: any) => {
            clearTimeout(timeoutTimer);
            const c = (pos && pos.coords) ? pos.coords : null;
            const lat = (c && typeof c.latitude === 'number' && Number.isFinite(c.latitude)) ? c.latitude : null;
            const lon = (c && typeof c.longitude === 'number' && Number.isFinite(c.longitude)) ? c.longitude : null;
            safeResolve({
              granted: (lat !== null && lon !== null),
              latitude: lat,
              longitude: lon,
            });
          },
          (err: any) => {
            clearTimeout(timeoutTimer);
            // GeolocationPositionError codes: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
            const code = (err && typeof err.code === 'number') ? err.code : 0;
            const msg = (err && typeof err.message === 'string') ? err.message : 'Unknown geolocation error';
            const human =
              code === 1 ? 'GEO_PERMISSION_DENIED'
              : code === 2 ? 'GEO_POSITION_UNAVAILABLE'
              : code === 3 ? 'GEO_TIMEOUT'
              : `GEO_ERROR_${code}`;
            safeResolve({
              granted: false,
              latitude: null,
              longitude: null,
              error_code: code,
              error_message: `${human}: ${msg}`,
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 9500,          // slightly less than our hard 10s timer above
            maximumAge: 30 * 1000,  // accept a cached position up to 30s old (faster UX)
          }
        );
      } catch (e: any) {
        clearTimeout(timeoutTimer);
        safeResolve({
          granted: false,
          latitude: null,
          longitude: null,
          error_code: 98,
          error_message: `GEO_EXCEPTION: ${String(e?.message || e || 'unknown')}`,
        });
      }
    });
  };

  // Human-readable Arabic error for each geolocation failure code
  const humanizeGeoError = (geo: BrowserGeoInfo): string => {
    const code = geo.error_code;
    const raw = geo.error_message || '';
    if (raw.includes('GEO_INSECURE_CONTEXT_HTTPS_REQUIRED')) {
      return 'يجب فتح النظام بروتوكول HTTPS آمن لتفعيل خدمة تحديد الموقع، أو استخدم localhost للتجربة المحلية.';
    }
    if (raw.includes('GEO_UNAVAILABLE_NO_BROWSER_SUPPORT')) {
      return 'متصفحك لا يدعم خدمة تحديد الموقع. جرّب Chrome أو Edge الحديث.';
    }
    if (code === 1 || raw.includes('GEO_PERMISSION_DENIED')) {
      return 'تم رفض صلاحية تحديد الموقع. يجب السماح بالوصول للموقع ثم المحاولة مجدداً.';
    }
    if (code === 2 || raw.includes('GEO_POSITION_UNAVAILABLE')) {
      return 'تعذر تحديد موقع جهازك حالياً. تحقق من تشغيل خدمة الموقع (GPS) في جهازك ثم أعد المحاولة.';
    }
    if (code === 3 || raw.includes('GEO_TIMEOUT')) {
      return 'لم يتم الرد على طلب تفعيل الموقع خلال 10 ثواني. أعد المحاولة واسمح بالوصول فور ظهور الرسالة.';
    }
    return 'حدث خطأ أثناء طلب صلاحية تحديد الموقع. أعد المحاولة.';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const fingerprint = captureFingerprint();

    // ============================================================
    // STEP 0 (OPTIONAL v005b): ATTEMPT browser GEO permission
    //   — If granted: attach browser GPS coords to the audit logs
    //   — If DENIED / failed / timeout: login STILL proceeds.
    //     We merely log geo_granted=false with null coords.
    // ============================================================
    setGeoRequesting(true);
    const browserGeo: BrowserGeoInfo = await requestBrowserGeoLocation();
    setGeoRequesting(false);

    // 🔥 Always record the geo result (whether granted or not)
    if (!browserGeo.granted) {
      try {
        void fetch('/api/audit/log-login-failure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            error: browserGeo.error_message || 'GEO_NOT_GRANTED_OPTIONAL',
            ...fingerprint,
            browser_geo_granted: false,
            browser_geo_lat: null,
            browser_geo_lon: null,
            browser_geo_error_code: browserGeo.error_code ?? null,
          }),
        }).catch(() => {});
      } catch {}
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // 🔥 LOGIN FAILURE AUDIT — fire & forget, NEVER block the UX
        try {
          void fetch('/api/audit/log-login-failure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              error: error?.message || 'Unknown auth failure',
              ...fingerprint,
              browser_geo_granted: browserGeo.granted,
              browser_geo_lat: browserGeo.latitude,
              browser_geo_lon: browserGeo.longitude,
            }),
          }).catch(() => {});
        } catch {}
        throw error;
      }

      const banRes = await fetch('/api/auth/ban-status', { method: 'GET' }).catch(() => null);
      if (banRes?.ok) {
        const banBody = await banRes.json().catch(() => ({} as any));
        if (banBody?.banned) {
          localStorage.removeItem('auth_ban_check_ts');
          await supabase.auth.signOut();
          router.replace('/login?banned=1');
          router.refresh();
          return;
        }
        // Cache the successful check for 1 hour to prevent immediate redundant checks in UserMenu
        localStorage.setItem('auth_ban_check_ts', Date.now().toString());
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('system_events').insert({
          event_type: 'user_login',
          message: 'تسجيل دخول',
          payload: {
            actor_id: user?.id || null,
            actor_email: user?.email || email
          }
        });
      } catch {}

      // ✅ Audit & Access Tracking — fire & forget, NEVER block login.
      // Now includes:
      //   · device fingerprint (screen/lang/tz)
      //   · server-resolved GEO location (IP-based → country/city/ISP)
      //   · 🔥 BROWSER PRECISE coords (GPS/WiFi → higher accuracy) — OPTIONAL
      try {
        void fetch('/api/tracking/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...fingerprint,
            browser_geo_granted: browserGeo.granted,
            browser_geo_lat: browserGeo.latitude,
            browser_geo_lon: browserGeo.longitude,
          }),
        }).catch(() => {});
      } catch {}

      router.push("/");
      router.refresh(); // Refresh to update middleware state
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-4" suppressHydrationWarning>
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative z-10">
        <div className="p-8">
          {/* Logo & Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4 shadow-lg shadow-blue-600/30">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">تسجيل الدخول</h1>
            <p className="text-blue-200 text-sm">أهلاً بك في نظام مساكن فندقية</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}
          {!error && banned && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm text-center">
              تم حظر حسابك. تواصل مع الإدارة لرفع الحظر.
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6" suppressHydrationWarning>
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-100 block">البريد الإلكتروني</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-blue-300" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full pl-3 pr-10 py-3 bg-white/5 border border-blue-400/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-100 block">كلمة المرور</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-blue-300" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-white/5 border border-blue-400/30 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-blue-300 hover:text-white transition-colors"
                  suppressHydrationWarning
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center space-x-2 space-x-reverse cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-blue-400/30 bg-white/5 text-blue-600 focus:ring-blue-500 transition-all" suppressHydrationWarning />
                <span className="text-blue-200 group-hover:text-white transition-colors">تذكرني</span>
              </label>
              <Link href="#" className="text-blue-300 hover:text-white hover:underline transition-colors">
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 transition-all duration-200 flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-70 disabled:cursor-not-allowed"
              suppressHydrationWarning
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="text-sm">
                    {geoRequesting
                      ? 'جاري تفعيل تحديد الموقع...'
                      : 'جاري تسجيل الدخول...'}
                  </span>
                </div>
              ) : (
                <>
                  <span>دخول للنظام</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <div className="bg-blue-950/50 p-4 text-center border-t border-white/10">
          <p className="text-blue-300/60 text-xs">
            © 2026 مساكن فندقية. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-4">
          <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative z-10">
            <div className="p-8 text-center text-blue-200">جارِ التحميل...</div>
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
