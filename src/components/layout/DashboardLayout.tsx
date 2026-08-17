'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuthContext } from '@/hooks/useAuthContext';
import FloatingSidebar from '@/components/layout/FloatingSidebar';
import { GlobalLoadingProvider } from '@/components/layout/GlobalLoadingProvider';
import { AppRouteLoading } from '@/components/layout/AppRouteLoading';
import AdminExtraAuthGate from '@/components/auth/AdminExtraAuthGate';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { role, loading, error, isHousekeeping, isReceptionist, user, signOut } = useAuthContext();
  const [slowAuth, setSlowAuth] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isEmbed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === '1';

  useEffect(() => {
    if (!loading) {
      setSlowAuth(false);
      return;
    }
    const t = setTimeout(() => setSlowAuth(true), 5000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (isEmbed) return;
    if (loading) return;
    if (role === 'receptionist') {
      const restrictedPaths = [
        '/units',
        '/reports',
        '/accounting',
        '/settings',
        '/admin',
      ];
      const isRestricted = restrictedPaths.some(path => pathname.startsWith(path));
      if (isRestricted) {
        router.replace('/');
      }
    }
  }, [isEmbed, pathname, role, loading, router]);

  useEffect(() => {
    if (isEmbed) return;
    if (loading) return;
    if (!user) {
      const authPaths = ['/login', '/auth'];
      const isAuthPath = authPaths.some((p) => pathname.startsWith(p));
      if (!isAuthPath) {
        router.replace('/login');
      }
    }
  }, [isEmbed, pathname, user, loading, router]);

  useEffect(() => {
    if (isEmbed) return;
    if (loading) return;
    if (role === 'housekeeping') {
      const allowedPrefixes = ['/cleaning'];
      const isAllowed = allowedPrefixes.some(path => pathname.startsWith(path));
      if (!isAllowed) {
        router.replace('/cleaning');
      }
    }
  }, [isEmbed, pathname, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          {slowAuth && (
            <div className="text-center space-y-2">
              <div className="text-sm font-bold text-gray-900">جارٍ تحميل الصلاحيات...</div>
              <div className="text-xs text-gray-600">إذا استمر التحميل، تحقق من الاتصال أو أعد تسجيل الدخول</div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
                >
                  إعادة المحاولة
                </button>
                <button
                  onClick={async () => { await signOut(); router.replace('/login'); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm font-bold hover:bg-gray-50 transition-colors"
                >
                  تسجيل الدخول
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center space-y-3">
          <div className="text-lg font-bold text-gray-900">تعذر تحميل الصلاحيات</div>
          <div className="text-sm text-gray-600">{error.message}</div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              إعادة المحاولة
            </button>
            <button
              onClick={async () => { await signOut(); router.replace('/login'); }}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-900 text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              تسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isEmbed) {
    const raw = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('scale') : null;
    const n = raw == null ? NaN : Number(raw);
    const embedScale = !Number.isFinite(n) ? 1 : Math.max(0.6, Math.min(1, n));
    if (embedScale === 1) {
      return (
        <GlobalLoadingProvider>
          <AppRouteLoading />
          <AdminExtraAuthGate>
            <div className="min-h-screen bg-white">{children}</div>
          </AdminExtraAuthGate>
        </GlobalLoadingProvider>
      );
    }
    return (
      <GlobalLoadingProvider>
        <AppRouteLoading />
        <div className="min-h-screen bg-white overflow-auto">
          <div
            style={{
              transform: `scale(${embedScale})`,
              transformOrigin: 'top center',
              width: `${100 / embedScale}%`,
              height: `${100 / embedScale}%`
            }}
          >
            <AdminExtraAuthGate>{children}</AdminExtraAuthGate>
          </div>
        </div>
      </GlobalLoadingProvider>
    );
  }

  return (
    <GlobalLoadingProvider>
      <AppRouteLoading />
      <AdminExtraAuthGate>
        <div className="min-h-screen bg-gray-50 flex">
          <div className="hidden 2xl:block">
            <Sidebar />
          </div>
          <FloatingSidebar />

          <div className="flex-1 transition-all duration-300 w-full 2xl:mr-64">
            <Header />
            <main className="p-3 md:p-4 lg:p-6 xl:p-8">
              <div className="mx-auto w-full max-w-screen-xl">
                {children}
              </div>
            </main>
          </div>
        </div>
      </AdminExtraAuthGate>
    </GlobalLoadingProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
