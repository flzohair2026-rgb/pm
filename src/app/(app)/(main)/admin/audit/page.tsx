'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Shield, Search, CalendarDays, RefreshCw, ChevronDown, ChevronUp,
  Loader2, Monitor, Globe2, AlertTriangle, CheckCircle2, Clock,
  MapPin, Server, Flag, Layers, ExternalLink, Navigation
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

import { EVENT_TYPES, AuditLog, GeoLocation } from '@/lib/tracking/types';
import { countryCodeToFlag } from '@/lib/tracking/geoip';

const EVENT_COLORS: Record<string, string> = {
  AUTH: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SESSION: 'bg-blue-100 text-blue-700 border-blue-200',
  SECURITY: 'bg-purple-100 text-purple-700 border-purple-200',
  USER: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  BOOKING: 'bg-amber-100 text-amber-700 border-amber-200',
  PAYMENT: 'bg-green-100 text-green-700 border-green-200',
  CONTRACT: 'bg-orange-100 text-orange-700 border-orange-200',
  UNIT: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  CLEANING: 'bg-sky-100 text-sky-700 border-sky-200',
  MAINTENANCE: 'bg-rose-100 text-rose-700 border-rose-200',
  SYSTEM: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'الأدمن',
  super_admin: 'سوبر أدمن',
  manager: 'المدير',
  receptionist: 'الاستقبال',
  housekeeping: 'هاوس كيبنج',
  accountant: 'محاسب',
  marketing: 'تسويق',
};

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'حاسوب',
  mobile: 'جوال',
  tablet: 'تابلت',
  bot: 'روبوت',
  unknown: 'غير معروف',
};

function getLocation(log: AuditLog): GeoLocation | null {
  return (log?.metadata?.location as GeoLocation) || null;
}

function formatLocationLine(loc: GeoLocation | null): { flag: string; line1: string; line2: string } {
  if (!loc) {
    return { flag: '🌐', line1: 'غير متوفر', line2: 'لم يتم حفظ موقع لهذا السجل' };
  }
  if (loc.country_code?.toUpperCase() === 'LOCAL') {
    return {
      flag: loc.flag_emoji || '🧪',
      line1: 'بيئة تشغيل محليّة',
      line2: 'localhost / شبكة داخلية',
    };
  }
  const flag = loc.flag_emoji || countryCodeToFlag(loc.country_code || null);
  const country = loc.country_name || '—';
  const pieces = [loc.city, loc.region].filter(Boolean);
  const line1 = pieces.length ? pieces.join(' · ') : country;
  const line2 = [country, loc.isp || ''].filter(Boolean).join(' — ');
  return { flag, line1, line2 };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [filterEventType, setFilterEventType] = useState<string>('ALL');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');

  const [filterCountry, setFilterCountry] = useState<string>('ALL');
  const [filterCity, setFilterCity] = useState<string>('ALL');

  const [limit] = useState(300);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    loadAccessAndData();
  }, []);

  const loadAccessAndData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAccessDenied(true);
        return;
      }

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role, is_super_admin')
        .eq('id', user.id)
        .maybeSingle();

      const role = (myProfile as any)?.role || null;
      const isSuperFlag = Boolean((myProfile as any)?.is_super_admin);
      setCurrentUserRole(role);

      const envSuper = (process.env.NEXT_PUBLIC_SUPER_ADMIN_ID as string | undefined)?.trim();
      const isSuper = isSuperFlag || (envSuper && envSuper === user.id);

      if (role !== 'admin' && role !== 'super_admin' && !isSuper) {
        setAccessDenied(true);
        return;
      }

      await fetchLogs(true);
    } catch (err: any) {
      console.error('[audit] access error:', err?.message || err);
      setAccessDenied(true);
    } finally {
      setLoading(false);
    }
  };

  // 🩹 Fallback Cache: السجلات القديمة تكون user_email / user_role فارغة بسبب خلل في
  // RPC القديم — نعوضها هنا باستعلام واحد على الجداول الأصلية.
  const hydrateUsers = async (rows: AuditLog[]): Promise<AuditLog[]> => {
    try {
      const missingIds = Array.from(new Set(
        rows
          .filter(r => r.user_id && (!r.user_email || !r.user_role))
          .map(r => String(r.user_id))
      )).slice(0, 300);
      if (!missingIds.length) return rows;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, role, email, full_name, is_deleted, is_banned')
        .in('id', missingIds)
        .limit(300);

      const profilesMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profilesMap.set(String(p.id), p));

      return rows.map(r => {
        if (!r.user_id) return r;
        if (r.user_email && r.user_role) return r;
        const pr = profilesMap.get(String(r.user_id));
        if (!pr) return r;
        const isGone = Boolean(pr.is_deleted) || Boolean(pr.is_banned);
        return {
          ...r,
          user_email: r.user_email || pr.email || pr.full_name ||
                      (isGone ? '⚠️ مستخدم محذوف/محظور' : null),
          user_role: r.user_role || pr.role || null,
        } as AuditLog;
      });
    } catch (e: any) {
      console.warn('[audit] hydrate-users fallback failed:', e?.message || e);
      return rows;
    }
  };

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, any> = {
        p_limit: limit,
        p_offset: 0,
      };
      if (filterEventType !== 'ALL') params.p_event_type = filterEventType;
      if (filterFrom) params.p_from = new Date(filterFrom).toISOString();
      if (filterTo) params.p_to = new Date(filterTo + 'T23:59:59').toISOString();
      if (filterSearch.trim()) params.p_search = filterSearch.trim();

      const { data, error } = await supabase
        .rpc('get_audit_logs', params);

      if (error) throw error;
      const raw = (data || []) as AuditLog[];
      const fixed = await hydrateUsers(raw);
      setLogs(fixed);
    } catch (err: any) {
      console.error('[audit] fetch error:', err?.message || err);
      alert('تعذر تحميل سجل النشاط. تأكد من تطبيق الـ Migration على قاعدة البيانات.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleApplyFilters = () => fetchLogs(true);
  const handleReset = () => {
    setFilterEventType('ALL');
    setFilterFrom('');
    setFilterTo('');
    setFilterSearch('');
    setFilterCountry('ALL');
    setFilterCity('ALL');
    setTimeout(() => fetchLogs(true), 0);
  };

  // 🧠 Local post-fetch filters (country + city) + search enrichment
  const filteredLogs = useMemo(() => {
    const term = filterSearch.trim().toLowerCase();
    return logs.filter(log => {
      if (filterCountry !== 'ALL') {
        const loc = getLocation(log);
        if ((loc?.country_code || '').toUpperCase() !== filterCountry) return false;
      }
      if (filterCity !== 'ALL') {
        const loc = getLocation(log);
        if ((loc?.city || '') !== filterCity) return false;
      }
      if (term) {
        const loc = getLocation(log);
        const haystack = [
          log.user_email, log.user_role, log.ip_address,
          log.browser, log.operating_system, log.device_type,
          log.event_type, log.event_name, log.error_code,
          loc?.country_name, loc?.country_code, loc?.city, loc?.region, loc?.isp
        ]
          .map(s => (s || '').toString().toLowerCase())
          .join(' ');
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [logs, filterCountry, filterCity, filterSearch]);

  const countries = useMemo(() => {
    const set = new Map<string, { code: string; name: string; flag: string; count: number }>();
    filteredLogs.forEach(log => {
      const loc = getLocation(log);
      if (!loc) return;
      const code = (loc.country_code || 'UNKNOWN').toUpperCase();
      const existing = set.get(code) || {
        code, name: loc.country_name || code,
        flag: loc.flag_emoji || countryCodeToFlag(code), count: 0,
      };
      existing.count += 1;
      set.set(code, existing);
    });
    return Array.from(set.values()).sort((a, b) => b.count - a.count);
  }, [filteredLogs]);

  const cities = useMemo(() => {
    const set = new Map<string, { city: string; count: number }>();
    const scope = filterCountry !== 'ALL' ? filteredLogs : filteredLogs;
    scope.forEach(log => {
      const loc = getLocation(log);
      const c = loc?.city;
      if (!c) return;
      if (filterCountry !== 'ALL') {
        if ((loc?.country_code || '').toUpperCase() !== filterCountry) return;
      }
      const existing = set.get(c) || { city: c, count: 0 };
      existing.count += 1;
      set.set(c, existing);
    });
    return Array.from(set.values()).sort((a, b) => b.count - a.count);
  }, [filteredLogs, filterCountry]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const uniqueIps = new Set(filteredLogs.map(l => l.ip_address).filter(Boolean));
    return {
      total: filteredLogs.length,
      today: filteredLogs.filter(l => new Date(l.created_at).toDateString() === today).length,
      logins: filteredLogs.filter(l => l.event_type === 'AUTH' && l.event_name === 'LOGIN_SUCCESS').length,
      failed: filteredLogs.filter(l => l.success === false).length,
      countries: countries.length,
      cities: cities.length,
      uniqueDevices: uniqueIps.size,
    };
  }, [filteredLogs, countries, cities]);

  if (accessDenied) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">وصول ممنوع</h2>
          <p className="text-gray-600 text-sm">هذه الصفحة خاصة بمسؤولي النظام فقط. دورك الحالي: {currentUserRole || 'غير محدد'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-800 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">مراقبة نشاط النظام</h1>
              <p className="text-sm text-gray-500">Audit &amp; Access Logs — تتبع عمليات الدخول، الجلسات، الأجهزة، والمواقع الجغرافية</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchLogs(false)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'جارِ التحميل...' : 'تحديث'}
        </button>
      </div>

      {/* Stats — 7 Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
        {[
          { label: 'إجمالي السجلات', value: stats.total, icon: Clock, color: 'from-slate-500 to-slate-700 text-white' },
          { label: 'اليوم', value: stats.today, icon: CalendarDays, color: 'from-blue-500 to-blue-700 text-white' },
          { label: 'تسجيلات دخول', value: stats.logins, icon: CheckCircle2, color: 'from-emerald-500 to-emerald-700 text-white' },
          { label: 'عمليات فاشلة', value: stats.failed, icon: AlertTriangle, color: 'from-rose-500 to-rose-700 text-white' },
          { label: 'دول', value: stats.countries, icon: Flag, color: 'from-indigo-500 to-indigo-700 text-white' },
          { label: 'مدن', value: stats.cities, icon: MapPin, color: 'from-cyan-500 to-cyan-700 text-white' },
          { label: 'أجهزة فريدة', value: stats.uniqueDevices, icon: Server, color: 'from-amber-500 to-amber-700 text-white' },
        ].map(item => (
          <div key={item.label} className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm bg-white">
            <div className={`bg-gradient-to-br ${item.color} p-4 flex items-center justify-between`}>
              <p className="text-xs font-semibold opacity-90">{item.label}</p>
              <item.icon className="w-4.5 h-4.5 opacity-80" />
            </div>
            <div className="p-4">
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Top Countries Strip (Geo summary) */}
      {countries.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">توزيع الدخول حسب الدولة</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {countries.map(c => (
              <button
                key={c.code}
                onClick={() => setFilterCountry(prev => prev === c.code ? 'ALL' : c.code)}
                title={`${c.name} (${c.count})`}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                  filterCountry === c.code
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="tabular-nums">{c.name}</span>
                <span className={`opacity-90 ${filterCountry === c.code ? 'text-emerald-50' : 'text-gray-500'}`}>×{c.count}</span>
              </button>
            ))}
            {filterCountry !== 'ALL' && (
              <button
                onClick={() => setFilterCountry('ALL')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-100 text-xs font-semibold transition-colors"
              >
                ✕ إلغاء التصفية حسب الدولة
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setShowFilters(s => !s)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Search className="w-4 h-4" /> فلاتر البحث المتقدمة
          </div>
          {showFilters ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>

        {showFilters && (
          <div className="px-6 pb-6 border-t border-gray-50 space-y-4 pt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">نوع الحدث</label>
                <select
                  value={filterEventType}
                  onChange={e => setFilterEventType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="ALL">الكل</option>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">الدولة</label>
                <select
                  value={filterCountry}
                  onChange={e => { setFilterCountry(e.target.value); setFilterCity('ALL'); }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="ALL">كل الدول</option>
                  {countries.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.count})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">المدينة</label>
                <select
                  value={filterCity}
                  onChange={e => setFilterCity(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="ALL">كل المدن</option>
                  {cities.map(c => (
                    <option key={c.city} value={c.city}>{c.city} ({c.count})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">من تاريخ</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={e => setFilterFrom(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">إلى تاريخ</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={e => setFilterTo(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">بحث سريع</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                    placeholder="IP / بريد / دولة / مدينة / مزود..."
                    className="w-full pr-10 pl-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
              >
                تصفير الفلاتر
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-slate-800 hover:from-emerald-700 hover:to-slate-900 rounded-lg transition-colors shadow-sm"
              >
                تطبيق البحث
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-emerald-700" />
            <p className="text-sm">جارِ تحميل سجل النشاط...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
              <Globe2 className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">لا توجد سجلات بعد</h3>
            <p className="text-sm text-gray-500 mb-4">جرب تغيير الفلاتر أو قم بتسجيل خروج ودخول مرة أخرى لتوليد أول سجل.</p>
            <p className="text-xs text-gray-400">تأكد من تطبيق ملف <code className="px-1.5 py-0.5 bg-gray-100 rounded font-mono">create_audit_access_system.sql</code> على Supabase.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-emerald-50 via-white to-slate-50 text-right border-b border-gray-100 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <th className="px-6 py-3.5">الوقت</th>
                  <th className="px-6 py-3.5">المستخدم</th>
                  <th className="px-6 py-3.5">الحدث</th>
                  <th className="px-6 py-3.5">الجهاز</th>
                  <th className="px-6 py-3.5">الموقع الجغرافي</th>
                  <th className="px-6 py-3.5">العنوان IP</th>
                  <th className="px-6 py-3.5 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.map(log => {
                  const eventColor = EVENT_COLORS[log.event_type] || EVENT_COLORS.SYSTEM;
                  const loc = getLocation(log);
                  const { flag, line1, line2 } = formatLocationLine(loc);
                  return (
                    <tr key={log.id} className="hover:bg-emerald-50/40 transition-colors group">
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                          {format(new Date(log.created_at), 'dd MMM yyyy — HH:mm:ss', { locale: ar })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          {(() => {
                            const emailRaw = log.user_email;
                            const hasAnyData = Boolean(log.user_id);
                            const isHardDeleted = !hasAnyData || (
                              !emailRaw && emailRaw !== null &&
                              typeof emailRaw === 'string' && emailRaw.startsWith('⚠️')
                            );
                            let displayEmail = emailRaw;
                            if (!displayEmail && !log.user_id) {
                              displayEmail = 'بيانات مجهولة (حدث قبل تسجيل الدخول)';
                            } else if (!displayEmail) {
                              displayEmail = 'لا يوجد بريد مسجّل في السجل (تُعوّض من الجدول الآن)';
                            }
                            const roleLabel = log.user_role
                              ? (ROLE_LABELS[log.user_role] || log.user_role)
                              : (log.user_id ? 'دور غير محدد في السجل — جارٍ التعويض...' : '—');
                            return (
                              <>
                                <span
                                  className={`font-semibold ${
                                    String(displayEmail).includes('⚠️')
                                      ? 'text-red-700'
                                      : String(displayEmail).includes('لا يوجد')
                                        ? 'text-amber-700'
                                        : 'text-gray-900'
                                  }`}
                                >
                                  {displayEmail}
                                </span>
                                <span
                                  className={`text-xs mt-0.5 ${
                                    roleLabel.includes('غير محدد') ? 'text-amber-600' : 'text-gray-500'
                                  }`}
                                >
                                  {roleLabel}
                                  {log.user_id && (
                                    <span className="ml-1 mr-1 text-[10px] text-gray-400 font-mono opacity-80">
                                      #{String(log.user_id).slice(0, 8)}
                                    </span>
                                  )}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${eventColor}`}>
                            {log.event_type}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{log.event_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-gray-700 font-medium text-xs">
                            <Monitor className="w-3.5 h-3.5 text-gray-400" />
                            {log.device_type ? DEVICE_LABELS[log.device_type] || log.device_type : '—'}
                          </div>
                          <span className="text-xs text-gray-500 mt-0.5">
                            {[log.operating_system, log.browser].filter(Boolean).join(' · ') || 'لا توجد تفاصيل'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl shadow-inner">
                            {flag}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{line1}</span>
                            </div>
                            <span className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[240px]" title={line2}>
                              {line2}
                            </span>
                            {loc?.browser_geo ? (
                              <div className="mt-1.5 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg px-2 py-1 text-[11px] w-fit">
                                <Navigation className="w-3 h-3 text-emerald-600" />
                                <span className="font-mono font-semibold tabular-nums" dir="ltr">
                                  {loc.browser_geo.lat.toFixed(4)}, {loc.browser_geo.lon.toFixed(4)}
                                </span>
                                {typeof loc.browser_geo.accuracy_meters === 'number' && (
                                  <span className="opacity-70">±{loc.browser_geo.accuracy_meters}م</span>
                                )}
                                <a
                                  href={`https://www.google.com/maps?q=${loc.browser_geo.lat},${loc.browser_geo.lon}&ll=${loc.browser_geo.lat},${loc.browser_geo.lon}&z=17`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                  title="فتح الموقع الدقيق على خريطة Google Maps"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  خريطة
                                </a>
                              </div>
                            ) : (
                              <div className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] text-gray-400 w-fit">
                                <AlertTriangle className="w-3 h-3 text-amber-500/80" />
                                سجل قديم — غير متوفر موقع دقيق (GPS) له
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-700">
                        <div className="flex flex-col">
                          <span dir="ltr" className="inline-block">{log.ip_address || '—'}</span>
                          {loc?.isp && (
                            <span className="text-[10px] text-gray-400 truncate max-w-[160px]" title={loc.isp}>
                              {loc.isp}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {log.success ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" /> ناجحة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                            <AlertTriangle className="w-4 h-4" /> فاشلة
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
