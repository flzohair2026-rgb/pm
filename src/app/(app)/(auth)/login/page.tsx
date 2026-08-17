"use client";

import { Suspense, useState } from "react";
import { Lock, Mail, Eye, EyeOff, ArrowRight, MapPin, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { BrowserGeoCoords } from "@/lib/tracking/types";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [geoStep, setGeoStep] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const banned = searchParams.get('banned') === '1';

  const requireBrowserGeo = (process.env.NEXT_PUBLIC_REQUIRE_BROWSER_GEO as string | undefined) !== 'false';

  const requestBrowserGeo = (): Promise<BrowserGeoCoords> => new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator?.geolocation) {
      reject(new Error('متصفحك الحالي لا يدعم تحديد الموقع. استخدم نسخة حديثة من Chrome أو Edge أو Safari.'));
      return;
    }
    setGeoStep(true);
    navigator.geolocation.getCurrentPosition(
      (pos: GeolocationPosition) => {
        setGeoStep(false);
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lon: Number(pos.coords.longitude.toFixed(6)),
          accuracy_meters: pos.coords.accuracy ? Number(pos.coords.accuracy.toFixed(1)) : null,
          altitude_meters: pos.coords.altitude ? Number(pos.coords.altitude.toFixed(1)) : null,
          heading_deg: pos.coords.heading ?? null,
          speed_mps: pos.coords.speed ?? null,
          source: 'browser_w3c',
          granted_at: new Date().toISOString(),
        });
      },
      (err: GeolocationPositionError) => {
        setGeoStep(false);
        let msg = 'تعذّر تحديد موقعك، يُرجى المحاولة مرة أخرى.';
        if (err?.code === 1) msg = 'يُرجى السماح للتطبيق بالوصول إلى موقعك — لا يمكن تسجيل الدخول دون تفعيل الموقع.';
        if (err?.code === 2) msg = 'لم يتمكّن النظام من تحديد موقعك. تفقد أن خدمات تحديد الموقع (GPS أو الإنترنت) مفعّلة في جهازك.';
        if (err?.code === 3) msg = 'استغرق تحديد موقعك وقتاً أطول من المتوقع. أغلق النافذة ثم أعد فتح التطبيق وحاول مجدداً.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    let browserGeo: BrowserGeoCoords | null = null;

    try {
      // 🛑 🛑 🛑 الموقع الجغرافي إلزامي قبل تسجيل الدخول — يُنفذ أولاً
      if (requireBrowserGeo) {
        try {
          browserGeo = await requestBrowserGeo();
        } catch (geoErr: any) {
          const msg = geoErr?.message || 'فشل تحديد الموقع الجغرافي.';
          setError(msg);
          // لا نكمل أي خطوة أخرى — حتى لا يتم إرسال كلمة المرور على الإطلاق
          setIsLoading(false);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
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

      // ✅ Audit & Access Tracking — نرسل معه الإحداثيات الدقيقة (إذا توفرت)
      try {
        const body: Record<string, any> = {};
        if (browserGeo) body.browser_geo = browserGeo;
        const sessionRes = await fetch('/api/tracking/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }).catch(() => null);

        if (requireBrowserGeo && sessionRes && !sessionRes.ok) {
          let serverMsg = 'تم رفض تسجيل الدخول من جهة الخادم بسبب فقدان بيانات الموقع.';
          try {
            const sbody = await sessionRes.json().catch(() => null);
            if (sbody?.error) serverMsg = sbody.error;
            if (sbody?.detail) serverMsg = `${serverMsg} — ${sbody.detail}`;
          } catch {}
          await supabase.auth.signOut().catch(() => {});
          setError(serverMsg);
          setIsLoading(false);
          return;
        }
      } catch {}

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setIsLoading(false);
      setGeoStep(false);
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

            {requireBrowserGeo && (
              <div className="bg-white/5 border border-white/15 rounded-xl p-3 flex items-start gap-2.5">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 text-blue-100 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-blue-100 mb-0.5">الموقع الجغرافي مطلوب</p>
                  <p className="text-[11px] text-blue-200/85 leading-snug">
                    قبل دخولك سيطلب المتصفح منك <span className="font-semibold">السماح بتحديد موقعك</span> لأغراض حماية النظام.
                    يُرجى اختيار <span className="font-semibold">السماح</span> لعدم إيقاف عملية الدخول.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 transition-all duration-200 flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-70 disabled:cursor-not-allowed"
              suppressHydrationWarning
            >
              {isLoading ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="text-sm font-semibold">
                    {geoStep ? 'جارٍ تحديد موقعك الدقيق...' : 'جارٍ تسجيل الدخول...'}
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
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300/80" />
            <p className="text-[11px] text-amber-200/80 font-semibold">
              مع تحيات الدعم الفني
            </p>
          </div>
          <p className="text-blue-300/60 text-xs">
            © 2026 مساكن الرفاهية. جميع الحقوق محفوظة.
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
