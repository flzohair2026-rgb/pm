'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Lock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
//  🔐 بوابة التحقق الإضافي للأدمن (Admin Extra Auth Gate)
//  - تعمل بعد تسجيل الدخول مباشرة للأدوار: admin, super_admin
//  - تطلب رمزاً إضافياً مخزناً في متغير البيئة ADMIN_EXTRA_AUTH_CODE
//  - تحفظ حالة التحقق في localStorage لمدة N ساعات (متغير الدورة)
// ---------------------------------------------------------------------------

const LS_KEY = 'admin_extra_auth_session_v1';
const DEFAULT_ROLES: string[] = ['admin', 'super_admin'];
const DEFAULT_DURATION_HOURS = 12;

type SessionState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'granted' }
  | { status: 'required'; userRole: string; userId: string }
  | { status: 'no-role' };

interface StoredSession {
  userId: string;
  role: string;
  grantedAt: number;  // timestamp ms
  expiresAt: number;  // timestamp ms
}

function readStoredSession(userId: string): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed.userId !== userId) return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(s: StoredSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function clearStoredSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LS_KEY);
}

function parseRolesEnv(): string[] {
  const raw = (process.env.NEXT_PUBLIC_ADMIN_EXTRA_AUTH_ROLES ?? '').trim();
  if (!raw) return DEFAULT_ROLES;
  return raw.split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
}

function parseDurationHours(): number {
  const raw = Number(process.env.NEXT_PUBLIC_ADMIN_EXTRA_AUTH_DURATION_HOURS);
  if (!isFinite(raw) || raw <= 0) return DEFAULT_DURATION_HOURS;
  return raw;
}

export default function AdminExtraAuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'checking' });
  const [codeInput, setCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1) فحص حالة المستخدم الحالي + صلاحياته + جلسة محفوظة سابقاً
  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setState({ status: 'idle' });
        return;
      }
      // جلب الدور من جدول profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_super_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;

      const role: string = (
        (profile as any)?.is_super_admin === true
          ? 'super_admin'
          : (profile as any)?.role ?? 'guest'
      ).toLowerCase();

      const protectedRoles = parseRolesEnv();
      if (!protectedRoles.includes(role)) {
        setState({ status: 'no-role' });
        return;
      }

      // فحص ما إذا كان لديه جلسة صالحة حالياً
      const existing = readStoredSession(user.id);
      if (existing) {
        setState({ status: 'granted' });
        return;
      }

      setState({ status: 'required', userRole: role, userId: user.id });
    }

    check();

    return () => { cancelled = true; };
  }, [supabase]);

  // 2) إرسال الرمز للخادم للتحقق (حتى لا يظهر الرمز في كود المتصفح للأمان)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.status !== 'required') return;
    if (!codeInput.trim()) {
      setErrorMsg('من فضلك أدخل الرمز');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/verify-extra-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput.trim() })
      });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setErrorMsg(body?.reason || body?.error || 'رمز غير صحيح');
        return;
      }
      // حفظ الجلسة محلياً لمدة N ساعات
      const now = Date.now();
      const durationMs = parseDurationHours() * 60 * 60 * 1000;
      writeStoredSession({
        userId: state.userId,
        role: state.userRole,
        grantedAt: now,
        expiresAt: now + durationMs
      });
      setState({ status: 'granted' });
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر الاتصال بخادم التحقق');
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    clearStoredSession();
    supabase.auth.signOut();
  }

  // ============== حالات العرض ==============
  if (state.status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-2 text-gray-600 text-sm">
          <Loader2 size={18} className="animate-spin" />
          <span>جارٍ فحص أمان الجلسة...</span>
        </div>
      </div>
    );
  }

  if (state.status === 'required') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden">
          {/* الهيدر */}
          <div className="bg-gradient-to-l from-emerald-700 to-emerald-600 px-6 py-5 text-white flex items-center gap-3">
            <div className="bg-white/15 p-2 rounded-lg">
              <Shield size={26} />
            </div>
            <div>
              <div className="text-lg font-bold">حماية إضافية للأدمن</div>
              <div className="text-xs text-emerald-100/90">من فضلك أدخل رمز التحقق الإضافي للمتابعة</div>
            </div>
          </div>

          {/* تنبيه دور المستخدم */}
          <div className="px-6 pt-5 pb-2 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border-b border-amber-100">
            <AlertTriangle size={14} />
            <span className="font-bold">الحساب الحالي:</span>
            <span className="uppercase font-mono bg-amber-100 px-1.5 py-0.5 rounded">{state.userRole}</span>
            <span>— يتطلب رمزاً إضافياً</span>
          </div>

          {/* النموذج */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">رمز التحقق الإضافي</label>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  autoFocus
                  autoComplete="off"
                  inputMode="numeric"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}
                  placeholder="أدخل الرمز المكون من 6 أرقام..."
                  className="w-full pr-11 pl-4 py-3 text-center text-xl font-bold tracking-widest rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                />
              </div>
              {errorMsg && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              <span>{submitting ? 'جارٍ التحقق...' : 'تأكيد الرمز والمتابعة'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-xs font-bold transition-colors"
            >
              تسجيل الخروج وتغيير الحساب
            </button>
          </form>

          <div className="px-6 pb-5 pt-0 text-[10px] text-gray-400 text-center">
            صلاحية التحقق = {parseDurationHours()} ساعة بعد النجاح
          </div>
        </div>
      </div>
    );
  }

  // أي حالة أخرى: المتاحة
  return <>{children}</>;
}
