'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Shield, Search, CalendarDays, RefreshCw, ChevronDown, ChevronUp,
  Loader2, Monitor, Globe2, AlertTriangle, CheckCircle2, Clock,
  MapPin, Wifi, MonitorSmartphone, Languages, Timer, Maximize2,
  XCircle, ExternalLink, ChevronRight, Gauge, Users, X,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

import { EVENT_TYPES, AuditLog } from '@/lib/tracking/types';
import { countryFlagEmoji, googleMapsLink } from '@/lib/tracking/geo';

const EVENT_GRADIENTS: Record<string, { chip: string; ring: string; glow: string; }> = {
  AUTH:       { chip: 'from-emerald-500 to-teal-600 text-white border-transparent', ring: 'ring-emerald-500/30', glow: 'shadow-emerald-500/20' },
  SESSION:    { chip: 'from-sky-500 to-blue-600 text-white border-transparent',     ring: 'ring-sky-500/30',     glow: 'shadow-sky-500/20'     },
  SECURITY:   { chip: 'from-fuchsia-500 to-purple-600 text-white border-transparent', ring: 'ring-fuchsia-500/30', glow: 'shadow-fuchsia-500/20' },
  USER:       { chip: 'from-indigo-500 to-violet-600 text-white border-transparent', ring: 'ring-indigo-500/30', glow: 'shadow-indigo-500/20'   },
  BOOKING:    { chip: 'from-amber-500 to-orange-600 text-white border-transparent', ring: 'ring-amber-500/30',  glow: 'shadow-amber-500/20'   },
  PAYMENT:    { chip: 'from-green-500 to-emerald-600 text-white border-transparent', ring: 'ring-green-500/30',  glow: 'shadow-green-500/20'   },
  CONTRACT:   { chip: 'from-orange-500 to-red-600 text-white border-transparent',    ring: 'ring-orange-500/30', glow: 'shadow-orange-500/20'  },
  UNIT:       { chip: 'from-cyan-500 to-sky-600 text-white border-transparent',      ring: 'ring-cyan-500/30',   glow: 'shadow-cyan-500/20'    },
  CLEANING:   { chip: 'from-sky-400 to-cyan-600 text-white border-transparent',      ring: 'ring-sky-400/30',    glow: 'shadow-sky-400/20'     },
  MAINTENANCE:{ chip: 'from-rose-500 to-red-600 text-white border-transparent',      ring: 'ring-rose-500/30',   glow: 'shadow-rose-500/20'    },
  SYSTEM:     { chip: 'from-slate-600 to-slate-800 text-white border-transparent',   ring: 'ring-slate-500/30',  glow: 'shadow-slate-500/20'   },
};

const EVENT_COLORS_FALLBACK = {
  chip: 'from-slate-500 to-slate-700 text-white border-transparent',
  ring: 'ring-slate-500/30',
  glow: 'shadow-slate-500/20',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'الأدمن',
  super_admin: 'مدير النظام',
  manager: 'المدير',
  receptionist: 'الاستقبال',
  housekeeping: 'هاوس كيبنج',
  accountant: 'محاسب',
  marketing: 'تسويق',
};

// ============================================================
// HYBRID DATA RESOLVER:
// Returns geo + client info from (A) dedicated columns if 005
// migration has been applied, OR (B) `metadata` jsonb fallback.
// Works BOTH with and without the SQL upgrade.
// ============================================================
interface ResolvedAuditExtra {
  country_code: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
  isp: string | null;
  org: string | null;
  geo_timezone: string | null;
  client_screen_res: string | null;
  client_language: string | null;
  client_timezone: string | null;
  attempted_email: string | null;
  // 🛰️ v005a — BROWSER PRECISE GEOLOCATION (GPS / WiFi) — Layer B
  // Captured BEFORE any auth attempt as MANDATORY precondition (v005a).
  browser_geo_lat: number | null;
  browser_geo_lon: number | null;
  browser_geo_granted: boolean | null;
  browser_geo_error_code: number | null;
}

function resolveAuditExtra(log: AuditLog): ResolvedAuditExtra {
  const md = (log && typeof log.metadata === 'object' && log.metadata) ? log.metadata : {};
  const pick = (a: any, b: any) => {
    if (typeof a === 'boolean') return a;
    if (typeof a === 'number') return a;
    if (typeof a === 'string' && a.length > 0) return a;
    if (typeof b === 'boolean') return b;
    if (typeof b === 'number') return b;
    if (typeof b === 'string' && b.length > 0) return b;
    return null;
  };
  const toNumOrNull = (v: any): number | null => {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return n;
    }
    return null;
  };
  const toBoolOrNull = (v: any): boolean | null => {
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === 1 || v === '1') return true;
    if (v === 'false' || v === 0 || v === '0') return false;
    return null;
  };
  return {
    country_code: pick(log.geo_country_code, md.geo_country_code) as any,
    country_name: pick(log.geo_country_name, md.geo_country_name) as any,
    region: pick(log.geo_region, md.geo_region) as any,
    city: pick(log.geo_city, md.geo_city) as any,
    zip: pick(log.geo_zip, md.geo_zip) as any,
    lat: toNumOrNull(pick(log.geo_lat, md.geo_lat)),
    lon: toNumOrNull(pick(log.geo_lon, md.geo_lon)),
    isp: pick(log.geo_isp, md.geo_isp) as any,
    org: pick(log.geo_org, md.geo_org) as any,
    geo_timezone: pick(log.geo_timezone, md.geo_timezone) as any,
    client_screen_res: pick(log.client_screen_res, md.client_screen_res) as any,
    client_language: pick(log.client_language, md.client_language) as any,
    client_timezone: pick(log.client_timezone, md.client_timezone) as any,
    attempted_email: pick(log.attempted_email, null) as any,
    // 🛰️ BROWSER PRECISE GEOLOCATION (v005a columns + metadata fallback)
    browser_geo_lat: toNumOrNull(pick((log as any).browser_geo_lat, md.browser_geo_lat)),
    browser_geo_lon: toNumOrNull(pick((log as any).browser_geo_lon, md.browser_geo_lon)),
    browser_geo_granted: toBoolOrNull(pick((log as any).browser_geo_granted, md.browser_geo_granted)),
    browser_geo_error_code: toNumOrNull(pick(null, md.browser_geo_error_code)),
  };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Filters
  const [filterEventType, setFilterEventType] = useState<string>('ALL');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');

  // View modes
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const [limit] = useState(150);
  const [showFilters, setShowFilters] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpanded = useCallback((id: string) => setExpandedId(prev => prev === id ? null : id), []);

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
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const role = (myProfile as any)?.role || null;
      setCurrentUserRole(role);

      if (role !== 'admin' && role !== 'super_admin') {
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
      setLogs((data || []) as AuditLog[]);
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
    setTimeout(() => fetchLogs(true), 0);
  };

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: logs.length,
      today: logs.filter(l => new Date(l.created_at).toDateString() === today).length,
      logins: logs.filter(l => l.event_type === 'AUTH' && l.event_name === 'LOGIN_SUCCESS').length,
      failed: logs.filter(l => l.success === false || l.event_name === 'LOGIN_FAILURE').length,
      uniqueCountries: new Set(
        logs
          .map(l => resolveAuditExtra(l).country_code)
          .filter(Boolean) as string[]
      ).size,
    };
  }, [logs]);

  if (accessDenied) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="text-center max-w-lg p-10 bg-white rounded-[28px] border border-slate-200/60 shadow-xl shadow-slate-900/5">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-100 via-red-50 to-rose-100 border border-red-200/60 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/10">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">وصول ممنوع</h2>
          <p className="text-slate-600 text-base leading-relaxed">هذه الصفحة خاصة بمسؤولي النظام فقط (الدور: Admin أو Super Admin).</p>
          <p className="mt-2 inline-block px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
            دورك الحالي: {currentUserRole || 'غير محدد'}
          </p>
        </div>
      </div>
    );
  }

  const firstLogDate = logs.length > 0
    ? formatDistanceToNow(new Date(logs[logs.length - 1].created_at), { addSuffix: true, locale: ar })
    : null;

  return (
    <div className="space-y-6 pb-8">
      {/* =========================================================
          HERO HEADER — Premium design with gradient background
          ========================================================= */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 p-6 md:p-8 shadow-2xl shadow-emerald-900/20">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-emerald-400/40 blur-xl" />
              <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-900/30 ring-1 ring-white/20">
                <Shield className="w-7 h-7 md:w-8 md:h-8" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-white min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-[11px] font-semibold text-emerald-50">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  مراقبة نشاط حية
                </span>
                {firstLogDate && (
                  <span className="hidden sm:inline text-[11px] text-emerald-100/80 font-medium">
                    أقدم سجل: {firstLogDate}
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
                سجل نشاط النظام
              </h1>
              <p className="mt-1 text-sm md:text-base text-emerald-100/85 max-w-xl leading-relaxed">
                Audit &amp; Access Logs — تتبع عمليات الدخول والجلسات والموقع الجغرافي الدقيق (GPS) والتقريبي (IP) لكل جهاز ومستخدم
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View mode toggle: premium segmented control */}
            <div className="inline-flex rounded-2xl bg-white/10 backdrop-blur-md p-1 border border-white/15 shadow-inner">
              <button
                onClick={() => setViewMode('table')}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  viewMode === 'table'
                    ? 'bg-white text-emerald-900 shadow-lg shadow-black/10 scale-[1.02]'
                    : 'text-emerald-50/90 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  جدول
                </span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  viewMode === 'cards'
                    ? 'bg-white text-emerald-900 shadow-lg shadow-black/10 scale-[1.02]'
                    : 'text-emerald-50/90 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Maximize2 className="w-4 h-4" />
                  بطاقات
                </span>
              </button>
            </div>

            {/* Refresh button: premium */}
            <button
              onClick={() => fetchLogs(false)}
              disabled={loading}
              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-900 rounded-2xl text-sm font-bold shadow-xl shadow-black/10 ring-1 ring-black/5 hover:shadow-2xl hover:shadow-black/15 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none"
            >
              <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              {loading ? 'جارِ التحميل...' : 'تحديث البيانات'}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          STATS ROW — Premium glass cards with animated gradients
          ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        {[
          {
            label: 'إجمالي السجلات',
            value: stats.total,
            icon: Clock,
            from: 'from-slate-700',
            via:  'via-slate-600',
            to:   'to-slate-800',
            soft: 'bg-slate-50 border-slate-100',
            iconSoft: 'bg-slate-100 text-slate-700',
          },
          {
            label: 'جديد اليوم',
            value: stats.today,
            icon: CalendarDays,
            from: 'from-sky-500',
            via:  'via-blue-500',
            to:   'to-indigo-600',
            soft: 'bg-sky-50 border-sky-100',
            iconSoft: 'bg-sky-100 text-sky-700',
          },
          {
            label: 'دخول ناجح',
            value: stats.logins,
            icon: CheckCircle2,
            from: 'from-emerald-500',
            via:  'via-teal-500',
            to:   'to-emerald-700',
            soft: 'bg-emerald-50 border-emerald-100',
            iconSoft: 'bg-emerald-100 text-emerald-700',
          },
          {
            label: 'محاولات فاشلة',
            value: stats.failed,
            icon: XCircle,
            from: 'from-rose-500',
            via:  'via-red-500',
            to:   'to-orange-600',
            soft: 'bg-rose-50 border-rose-100',
            iconSoft: 'bg-rose-100 text-rose-700',
          },
          {
            label: 'دول الدخول',
            value: stats.uniqueCountries,
            icon: Globe2,
            from: 'from-violet-500',
            via:  'via-fuchsia-500',
            to:   'to-purple-600',
            soft: 'bg-violet-50 border-violet-100',
            iconSoft: 'bg-violet-100 text-violet-700',
          },
        ].map(item => (
          <div
            key={item.label}
            className={`group relative overflow-hidden rounded-2xl border ${item.soft} p-4 md:p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5`}
          >
            {/* Animated gradient glow on hover */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.07] transition-opacity duration-500 bg-gradient-to-br ${item.from} ${item.via} ${item.to}`} />

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] md:text-xs font-semibold text-slate-500 mb-1.5 truncate">{item.label}</p>
                <p className={`text-2xl md:text-3xl font-black bg-gradient-to-br ${item.from} ${item.via} ${item.to} bg-clip-text text-transparent tracking-tight tabular-nums leading-none`}>
                  {String(item.value).padStart(2, '0')}
                </p>
              </div>
              <div className={`relative shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center ${item.iconSoft} transition-all group-hover:scale-110 group-hover:rotate-6 duration-300`}>
                <item.icon className="w-5 h-5 md:w-5.5 md:h-5.5" strokeWidth={2.2} />
                <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${item.from} ${item.via} ${item.to} opacity-0 group-hover:opacity-20 blur transition-opacity`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* =========================================================
          FILTERS CARD — Premium glassmorphism panel
          ========================================================= */}
      <div className="relative overflow-hidden rounded-[24px] bg-white border border-slate-200/70 shadow-xl shadow-slate-900/[0.04]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent" />

        {/* Collapse header */}
        <button
          onClick={() => setShowFilters(s => !s)}
          className="w-full px-6 md:px-8 py-5 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800 flex items-center justify-center ring-1 ring-emerald-200/60">
              <Search className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div className="text-right">
              <div className="text-sm font-extrabold text-slate-900">فلاتر البحث والفرز المتقدم</div>
              <div className="text-[11px] text-slate-500 mt-0.5">نوع الحدث · نطاق التواريخ · بحث سريع شامل</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(filterEventType !== 'ALL' || filterFrom || filterTo || filterSearch.trim()) && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                فلاتر مفعّلة
              </span>
            )}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-600 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`}>
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {showFilters && (
          <div className="px-6 md:px-8 pb-6 border-t border-slate-100 space-y-5 pt-6 bg-gradient-to-b from-slate-50/40 to-transparent">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Event type */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 tracking-wide">نوع الحدث</label>
                <div className="relative">
                  <select
                    value={filterEventType}
                    onChange={e => setFilterEventType(e.target.value)}
                    className="w-full appearance-none px-4 py-3 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 outline-none transition-all hover:border-slate-300 shadow-sm"
                  >
                    <option value="ALL">🌐 الكل ({logs.length})</option>
                    {EVENT_TYPES.map(t => {
                      const n = logs.filter(l => l.event_type === t).length;
                      return <option key={t} value={t}>{t} · {n}</option>;
                    })}
                  </select>
                  <ChevronDown className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* From date */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 tracking-wide">من تاريخ</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={e => setFilterFrom(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 outline-none transition-all hover:border-slate-300 shadow-sm [color-scheme:dark_light]"
                />
              </div>

              {/* To date */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 tracking-wide">إلى تاريخ</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={e => setFilterTo(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 outline-none transition-all hover:border-slate-300 shadow-sm [color-scheme:dark_light]"
                />
              </div>

              {/* Quick search (2 cols) */}
              <div className="lg:col-span-2 space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 tracking-wide">
                  بحث سريع شامل — IP · بريد · مدينة · متصفح · دور · مزود إنترنت
                </label>
                <div className="relative group">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                    placeholder="الرياض · Chrome · 192.168. · STC · زائر@..."
                    className="w-full pr-12 pl-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 outline-none transition-all hover:border-slate-300 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Actions row */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Users className="w-3.5 h-3.5" />
                <span className="font-medium">يعرض {logs.length} سجل من آخر {limit} حدث</span>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all hover:scale-[1.01] border border-slate-200"
                >
                  <X className="w-4 h-4" />
                  تصفير الفلاتر
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-extrabold text-white bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 hover:from-emerald-700 hover:to-teal-900 rounded-xl shadow-lg shadow-emerald-700/20 hover:shadow-xl hover:shadow-emerald-700/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Search className="w-4 h-4" />
                  تطبيق البحث
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          BODY: Loading / Empty / Table / Cards
          ========================================================= */}
      {loading ? (
        <div className="bg-white border border-slate-200/70 rounded-[24px] py-28 flex flex-col items-center justify-center text-slate-500 shadow-xl shadow-slate-900/[0.04]">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
            <Loader2 className="relative w-11 h-11 animate-spin text-emerald-700" strokeWidth={2.2} />
          </div>
          <p className="text-sm font-bold text-slate-700">جارِ تحميل سجل النشاط...</p>
          <p className="text-xs text-slate-400 mt-1">يتم جلب آخر {limit} حدث من قاعدة البيانات</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-slate-200/70 rounded-[24px] py-24 text-center px-6 shadow-xl shadow-slate-900/[0.04]">
          <div className="relative inline-flex mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-slate-300/30 blur-xl" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-50 via-white to-slate-100 border border-slate-200/60 flex items-center justify-center shadow-lg shadow-slate-900/5">
              <Globe2 className="w-9 h-9 text-slate-400" strokeWidth={1.8} />
            </div>
          </div>
          <h3 className="text-xl font-extrabold text-slate-800 mb-2">لا توجد سجلات بعد</h3>
          <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto leading-relaxed">
            جرب تغيير الفلاتر أو قم بتسجيل خروج ودخول مرة أخرى لتوليد أول سجل مع موقع الجهاز الدقيق (GPS) والتقريبي (IP).
          </p>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto">
            تأكد من تطبيق ملف&nbsp;
            <code className="px-2 py-1 rounded-lg bg-slate-100 font-mono text-slate-600 border border-slate-200/60">
              005_SETUP_LOGIN_GEO_AUDIT.sql
            </code>
            &nbsp;على Supabase لتفعيل أعمدة الموقع.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <AuditTableView logs={logs} expandedId={expandedId} toggleExpanded={toggleExpanded} />
      ) : (
        <AuditCardsView logs={logs} expandedId={expandedId} toggleExpanded={toggleExpanded} />
      )}
    </div>
  );
}

// ============================================================
// TABLE VIEW — Premium modern design
// ============================================================
function AuditTableView({
  logs, expandedId, toggleExpanded,
}: { logs: AuditLog[]; expandedId: string | null; toggleExpanded: (id: string) => void; }) {
  return (
    <div className="bg-white border border-slate-200/70 rounded-[24px] overflow-hidden shadow-xl shadow-slate-900/[0.04]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 via-emerald-50/50 to-slate-50 text-right border-b-2 border-slate-100 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
              <th className="px-5 py-4 w-12"></th>
              <th className="px-5 py-4">الوقت</th>
              <th className="px-5 py-4">المستخدم</th>
              <th className="px-5 py-4">الحدث</th>
              <th className="px-5 py-4 min-w-[480px]">الموقع الجغرافي: 🔴 دقيق · 🔵 تقريبي</th>
              <th className="px-5 py-4">الجهاز</th>
              <th className="px-5 py-4">العنوان IP</th>
              <th className="px-5 py-4 text-center w-28">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log, idx) => {
              const extra = resolveAuditExtra(log);
              const eventStyle = EVENT_GRADIENTS[log.event_type] || EVENT_COLORS_FALLBACK;
              const ipMapsUrl = googleMapsLink(extra.lat, extra.lon);
              const browserMapsUrl = googleMapsLink(extra.browser_geo_lat, extra.browser_geo_lon);
              const isExpanded = expandedId === log.id;
              const zebra = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
              const isLoginOk = log.success && log.event_name !== 'LOGIN_FAILURE';
              return (
                <React.Fragment key={log.id}>
                  <tr
                    className={`${zebra} hover:bg-gradient-to-l hover:from-emerald-50/60 hover:to-teal-50/40 transition-all duration-300 cursor-pointer group ${isExpanded ? '!bg-gradient-to-l !from-emerald-100/70 !via-emerald-50/60 !to-teal-100/50' : ''}`}
                    onClick={() => toggleExpanded(log.id)}
                  >
                    <td className="px-5 py-4 text-slate-400">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-emerald-600 text-white scale-110' : 'bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-700'}`}>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 whitespace-nowrap align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-600/80" />
                          <span className="font-bold text-slate-800 text-[13px]">
                            {format(new Date(log.created_at), 'dd MMM yyyy', { locale: ar })}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mr-5 font-medium">
                          الساعة {format(new Date(log.created_at), 'HH:mm:ss', { locale: ar })}
                        </div>
                        <div className="text-[10px] text-slate-400 mr-5">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ar })}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-extrabold text-slate-900 text-[13.5px] leading-tight">
                          {log.event_name === 'LOGIN_FAILURE' && extra.attempted_email
                            ? extra.attempted_email
                            : (log.user_email || 'مستخدم محذوف')}
                        </span>
                        <span className="inline-flex w-fit items-center gap-1 text-[10.5px] font-bold text-slate-600 bg-slate-100/80 border border-slate-200/60 px-2 py-0.5 rounded-lg">
                          {log.event_name === 'LOGIN_FAILURE'
                            ? '🔒 محاولة دخول'
                            : (log.user_role ? (ROLE_LABELS[log.user_role] || log.user_role) : 'بدون دور')}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-xl border text-[11px] font-black bg-gradient-to-br shadow-sm ${eventStyle.chip} shadow-[0_2px_6px_rgba(0,0,0,0.06)]`}>
                            {log.event_type}
                          </span>
                        </div>
                        <span className="text-[13px] font-extrabold text-slate-800 leading-tight">{log.event_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* 🔴 BROWSER PRECISE GEOLOCATION (GPS) */}
                        <div className={`relative overflow-hidden rounded-2xl p-3 border transition-all group-hover:shadow-lg ${
                          (extra.browser_geo_lat !== null && extra.browser_geo_lon !== null)
                            ? 'bg-gradient-to-br from-rose-50 via-rose-50/60 to-pink-50/40 border-rose-200/70'
                            : 'bg-gradient-to-br from-slate-50 to-slate-100/60 border-slate-200/70'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-sm">
                                <MapPin className="w-3.5 h-3.5" strokeWidth={2.3} />
                              </div>
                              <span className="text-[11px] font-black text-rose-800">دقيق · GPS</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {extra.browser_geo_granted === true && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded-md">
                                  <CheckCircle2 className="w-3 h-3" /> مفعّل
                                </span>
                              )}
                              {extra.browser_geo_granted === false && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded-md">
                                  <XCircle className="w-3 h-3" /> مرفوض
                                </span>
                              )}
                            </div>
                          </div>

                          {(extra.browser_geo_lat !== null && extra.browser_geo_lon !== null) ? (
                            <div className="space-y-1.5">
                              <div className="font-mono text-[10.5px] text-rose-700 font-bold bg-white/70 rounded-lg px-2 py-1 border border-rose-100/70 inline-block">
                                {extra.browser_geo_lat.toFixed(5)}, {extra.browser_geo_lon.toFixed(5)}
                              </div>
                              <div>
                                {browserMapsUrl && (
                                  <a
                                    href={browserMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[10.5px] font-black text-white bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 px-2.5 py-1 rounded-lg shadow-sm shadow-rose-500/20 transition-all hover:scale-[1.02]"
                                  >
                                    خرائط Google <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10.5px] text-slate-500 space-y-1 font-medium">
                              {extra.browser_geo_granted === false ? (
                                <>
                                  <div className="font-bold text-rose-700">🚫 رُفض الصلاحية أو تعذر التحديد</div>
                                  {extra.browser_geo_error_code !== null && (
                                    <div className="font-mono text-slate-600 bg-slate-100/80 rounded-md px-2 py-0.5 inline-block">
                                      رمز الخطأ: {extra.browser_geo_error_code}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div>📭 لا توجد بيانات (سجلات قديمة)</div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 🔵 IP-BASED APPROXIMATE GEOLOCATION */}
                        <div className={`relative overflow-hidden rounded-2xl p-3 border transition-all group-hover:shadow-lg ${
                          (extra.country_code || extra.city)
                            ? 'bg-gradient-to-br from-sky-50 via-cyan-50/60 to-blue-50/40 border-sky-200/70'
                            : 'bg-gradient-to-br from-slate-50 to-slate-100/60 border-slate-200/70'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-sm">
                                <Globe2 className="w-3.5 h-3.5" strokeWidth={2.3} />
                              </div>
                              <span className="text-[11px] font-black text-sky-800">تقريبي · IP</span>
                            </div>
                            {(extra.country_code || extra.city) && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                            )}
                          </div>

                          {(extra.country_code || extra.city) ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2 py-1 border border-sky-100/70">
                                <span className="text-xl leading-none" title={extra.country_name || ''}>
                                  {countryFlagEmoji(extra.country_code)}
                                </span>
                                <div className="flex flex-col leading-tight min-w-0">
                                  <span className="font-black text-sky-900 text-[12px] truncate">
                                    {extra.city || extra.country_name || '—'}
                                  </span>
                                  <span className="text-[10px] text-sky-700/90 truncate">
                                    {[extra.region, extra.country_name].filter(v => v && v !== extra.city).join(' · ') || extra.country_name}
                                  </span>
                                </div>
                              </div>
                              {(extra.lat !== null && extra.lon !== null) && (
                                <>
                                  <div className="font-mono text-[10.5px] text-sky-700 font-bold bg-white/70 rounded-lg px-2 py-1 border border-sky-100/70 inline-block">
                                    {extra.lat.toFixed(5)}, {extra.lon.toFixed(5)}
                                  </div>
                                  <div>
                                    {ipMapsUrl && (
                                      <a
                                        href={ipMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 text-[10.5px] font-black text-white bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-2.5 py-1 rounded-lg shadow-sm shadow-sky-500/20 transition-all hover:scale-[1.02]"
                                      >
                                        خرائط Google <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10.5px] text-slate-500 flex items-center gap-1.5 font-medium">
                              <Globe2 className="w-3.5 h-3.5" /> غير متوفر
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[12.5px]">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <Monitor className="w-3.5 h-3.5" />
                          </div>
                          {log.device_type ? {
                            desktop: 'حاسوب',
                            mobile: 'جوال',
                            tablet: 'تابلت',
                            bot: 'روبوت',
                            unknown: 'غير معروف',
                          }[log.device_type] || log.device_type : '—'}
                        </div>
                        <span className="text-[11px] text-slate-500 mr-7 font-medium leading-snug">
                          {[log.operating_system, log.browser].filter(Boolean).join(' · ') || 'لا توجد تفاصيل'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="font-mono text-[11.5px] text-slate-700 font-bold bg-slate-900/[0.04] border border-slate-200/60 px-2.5 py-1.5 rounded-lg inline-block tracking-tight">
                        {log.ip_address || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center align-top">
                      {isLoginOk ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-sm shadow-emerald-500/10">
                          <CheckCircle2 className="w-4 h-4" /> ناجحة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-800 bg-gradient-to-br from-red-50 to-rose-50 px-3 py-1.5 rounded-xl border border-red-200 shadow-sm shadow-red-500/10">
                          <XCircle className="w-4 h-4" /> فاشلة
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gradient-to-l from-emerald-50/70 via-teal-50/50 to-slate-50 border-b border-emerald-200/60">
                      <td colSpan={8} className="px-6 md:px-10 py-6 md:py-7">
                        <ExpandedDetails
                          log={log}
                          extra={extra}
                          ipMapsUrl={ipMapsUrl}
                          browserMapsUrl={browserMapsUrl}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// CARDS VIEW — Premium dashboard-style cards
// ============================================================
function AuditCardsView({
  logs, expandedId, toggleExpanded,
}: { logs: AuditLog[]; expandedId: string | null; toggleExpanded: (id: string) => void; }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
      {logs.map(log => {
        const extra = resolveAuditExtra(log);
        const eventStyle = EVENT_GRADIENTS[log.event_type] || EVENT_COLORS_FALLBACK;
        const ipMapsUrl = googleMapsLink(extra.lat, extra.lon);
        const browserMapsUrl = googleMapsLink(extra.browser_geo_lat, extra.browser_geo_lon);
        const isAuth = log.event_type === 'AUTH';
        const isSuccess = log.success && log.event_name !== 'LOGIN_FAILURE';
        const isExpanded = expandedId === log.id;

        const topStrip = isAuth
          ? (isSuccess
              ? 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-600'
              : 'bg-gradient-to-r from-rose-400 via-red-500 to-orange-600')
          : `bg-gradient-to-r ${eventStyle.chip.split(' ').slice(0, 3).join(' ')}`;

        return (
          <div
            key={log.id}
            className={`group relative bg-white rounded-[26px] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-slate-900/[0.08] ${
              isExpanded
                ? 'ring-2 ring-emerald-500/40 border-emerald-300 shadow-2xl shadow-emerald-900/5'
                : 'border border-slate-200/70 shadow-xl shadow-slate-900/[0.03]'
            }`}
          >
            {/* Decorative gradient strip */}
            <div className={`h-2.5 w-full ${topStrip}`} />

            {/* Ambient glow on hover */}
            <div className={`pointer-events-none absolute -inset-px rounded-[26px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-2xl bg-gradient-to-br ${eventStyle.chip.split(' ').slice(0, 3).join(' ')}`} style={{ opacity: 0.06 }} />

            <div className="p-5 md:p-6 space-y-4">
              {/* Top row: status + flag + time */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-md opacity-50" />
                    <div className="relative w-12 h-12 md:w-13 md:h-13 rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200/60 flex items-center justify-center text-3xl shadow-inner shrink-0">
                      {countryFlagEmoji(extra.country_code)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm md:text-[15px] font-extrabold text-slate-900 truncate leading-tight">
                      {extra.city || extra.country_name || '📍 موقع غير محدد'}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-medium">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      {format(new Date(log.created_at), 'dd MMM — HH:mm', { locale: ar })}
                    </div>
                  </div>
                </div>
                <div className={`shrink-0 inline-flex items-center px-2.5 py-1.5 rounded-xl border text-[10.5px] font-black bg-gradient-to-br shadow-sm ${eventStyle.chip} shadow-[0_2px_8px_rgba(0,0,0,0.08)]`}>
                  {log.event_type}
                </div>
              </div>

              {/* User & action */}
              <div>
                <div className="text-[10.5px] font-bold text-slate-500 mb-1.5 tracking-wide uppercase">المستخدم والحدث</div>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold text-slate-900 text-[13.5px] md:text-sm truncate leading-tight">
                    {log.event_name === 'LOGIN_FAILURE' && extra.attempted_email
                      ? extra.attempted_email
                      : (log.user_email || '—')}
                  </div>
                  {isSuccess ? (
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 ml-1">
                      <CheckCircle2 className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                    </div>
                  ) : (
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center shadow-lg shadow-red-500/25 ml-1">
                      <XCircle className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
                <div className="mt-1.5 text-[11.5px] text-slate-600 font-semibold leading-snug">
                  <span className="inline-block bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-lg mr-1 mb-0.5">
                    {log.user_role ? (ROLE_LABELS[log.user_role] || log.user_role) : (log.event_name === 'LOGIN_FAILURE' ? 'محاولة دخول' : 'بدون دور')}
                  </span>
                  <span className="text-slate-700 font-extrabold">{log.event_name}</span>
                </div>
              </div>

              {/* Geo mini summary (two layers mini) */}
              <div className="grid grid-cols-2 gap-2">
                {/* Mini precise geo */}
                <div className="rounded-xl border border-rose-100/80 bg-gradient-to-br from-rose-50/80 to-pink-50/50 p-2.5">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-rose-800">دقيق GPS</span>
                  </div>
                  <div className="text-[10px] text-rose-700 font-bold leading-tight">
                    {(extra.browser_geo_lat !== null && extra.browser_geo_lon !== null)
                      ? `${extra.browser_geo_lat.toFixed(4)}, ${extra.browser_geo_lon.toFixed(4)}`
                      : extra.browser_geo_granted === false
                        ? '🚫 مرفوض'
                        : 'لا توجد بيانات'}
                  </div>
                </div>
                {/* Mini IP geo */}
                <div className="rounded-xl border border-sky-100/80 bg-gradient-to-br from-sky-50/80 to-cyan-50/50 p-2.5">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0">
                      <Globe2 className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-sky-800">تقريبي IP</span>
                  </div>
                  <div className="text-[10px] text-sky-700 font-bold leading-tight truncate">
                    {(extra.country_code || extra.city)
                      ? (extra.city || extra.country_name || '')
                      : 'غير متوفر'}
                  </div>
                </div>
              </div>

              {/* Meta chips: device · browser · ip */}
              <div className="flex flex-wrap gap-1.5">
                <Chip icon={<MonitorSmartphone className="w-3 h-3" />}>
                  {log.device_type ? ({
                    desktop: 'حاسوب', mobile: 'جوال', tablet: 'تابلت', bot: 'روبوت', unknown: '—',
                  } as any)[log.device_type] || log.device_type : '—'}
                </Chip>
                <Chip icon={<Monitor className="w-3 h-3" />}>
                  {[log.operating_system, log.browser].filter(Boolean).join(' · ') || '—'}
                </Chip>
                <Chip icon={<Globe2 className="w-3 h-3" />}>{log.ip_address || '—'}</Chip>
                {extra.isp && (
                  <Chip icon={<Wifi className="w-3 h-3" />}>{extra.isp}</Chip>
                )}
              </div>

              {/* Expand / collapse button */}
              <div className="pt-1">
                <button
                  onClick={() => toggleExpanded(log.id)}
                  className="group/btn w-full inline-flex items-center justify-between text-xs font-extrabold text-white bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 hover:from-emerald-800 hover:to-teal-950 rounded-xl px-4 py-2.5 transition-all shadow-lg shadow-emerald-800/20 hover:shadow-xl hover:shadow-emerald-800/25 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" />
                    عرض التفاصيل الكاملة
                  </span>
                  <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>
                {isExpanded && (
                  <div className="mt-4 rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 p-4 shadow-inner">
                    <ExpandedDetails
                      log={log}
                      extra={extra}
                      ipMapsUrl={ipMapsUrl}
                      browserMapsUrl={browserMapsUrl}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Chip({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-700 bg-gradient-to-br from-slate-50 to-white border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-sm shadow-slate-900/[0.02] hover:border-slate-300 transition-colors">
      <span className="text-slate-500">{icon}</span>
      {children}
    </span>
  );
}

// ============================================================
// EXPANDED DETAILS PREMIUM (shared between Table & Cards views)
// DUAL GEOLOCATION: 🔴 Precise (GPS browser) + 🔵 Approximate (IP)
// ============================================================
function ExpandedDetails({
  log, extra, ipMapsUrl, browserMapsUrl, compact = false,
}: {
  log: AuditLog;
  extra: ResolvedAuditExtra;
  ipMapsUrl: string | null;
  browserMapsUrl: string | null;
  compact?: boolean;
}) {
  const geoErrorLabel = (code: number | null): string | null => {
    switch (code) {
      case 1: return 'رفض المستخدم لصلاحية الموقع';
      case 2: return 'خدمة تحديد الموقع غير متاحة';
      case 3: return 'انتهت مهلة طلب الموقع';
      case 98: return 'استثناء غير متوقع أثناء جلب الموقع';
      case 99: return 'الاتصال غير آمن أو المتصفح لا يدعم الجيولوجيشن';
      default: return null;
    }
  };

  type SectionTone = {
    title: string;
    icon: any;
    header: {
      from: string;
      via: string;
      to: string;
      text: string;
      ring: string;
      glow: string;
    };
    button: {
      from: string;
      to: string;
      label: string;
    };
    items: [string, React.ReactNode][];
  };

  const buildGeoButton = (url: string | null, hasCoords: boolean, tone: SectionTone['button']) =>
    (url && hasCoords) ? (
      <a
        key={tone.label}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-br ${tone.from} ${tone.to} text-white text-[11px] font-bold shadow-lg shadow-slate-900/5 hover:shadow-xl hover:shadow-slate-900/10 hover:-translate-y-0.5 transition-all duration-200`}
      >
        {tone.label}
        <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    ) : null;

  const sections: SectionTone[] = [
    // 🔴 LAYER A: BROWSER PRECISE GEOLOCATION (GPS)
    {
      title: 'الموقع الدقيق · GPS المتصفح',
      icon: MapPin,
      header: {
        from: 'from-rose-500',
        via: 'via-pink-500',
        to: 'to-rose-600',
        text: 'text-white',
        ring: 'ring-rose-500/20',
        glow: 'shadow-rose-500/15',
      },
      button: {
        from: 'from-rose-500',
        to: 'to-pink-600',
        label: 'عرض على الخريطة',
      },
      items: compact
        ? [
            ['صلاحية الموقع',
              extra.browser_geo_granted === true
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200/60">مفعلة <CheckCircle2 className="w-3 h-3" /></span>
                : extra.browser_geo_granted === false
                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200/60">مرفوضة <XCircle className="w-3 h-3" /></span>
                  : <span className="text-slate-400 text-[11px]">غير مسجلة</span>
            ],
            ['الإحداثيات', (extra.browser_geo_lat !== null && extra.browser_geo_lon !== null)
              ? <span key="c" className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900 text-slate-100 font-mono text-[10.5px] border border-slate-800 shadow-inner">{extra.browser_geo_lat.toFixed(6)}, {extra.browser_geo_lon.toFixed(6)}</span>
              : null],
            ['رمز الخطأ', extra.browser_geo_error_code !== null
              ? <div key="err" className="text-left">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-50 text-amber-800 font-mono text-[10.5px] border border-amber-200/70">
                    <AlertTriangle className="w-3 h-3" />
                    ERR_{String(extra.browser_geo_error_code).padStart(2, '0')}
                  </span>
                  {geoErrorLabel(extra.browser_geo_error_code) && (
                    <div className="mt-1 text-[10.5px] text-amber-700 font-semibold leading-tight">{geoErrorLabel(extra.browser_geo_error_code)}</div>
                  )}
                </div>
              : null],
            ['خرائط Google', buildGeoButton(browserMapsUrl, extra.browser_geo_lat !== null && extra.browser_geo_lon !== null, { from: 'from-rose-500', to: 'to-pink-600', label: 'موقع دقيق' })],
          ]
        : [
            ['صلاحية تحديد الموقع',
              extra.browser_geo_granted === true
                ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-800 font-bold text-[11.5px] border border-emerald-200/70 shadow-sm shadow-emerald-900/5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    مفعلة بالكامل
                  </span>
                : extra.browser_geo_granted === false
                  ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 text-rose-800 font-bold text-[11.5px] border border-rose-200/70 shadow-sm shadow-rose-900/5">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      مرفوضة من المستخدم
                    </span>
                  : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 text-slate-500 font-semibold text-[11.5px] border border-slate-200/70">غير مسجلة</span>
            ],
            ['خط العرض (Latitude)', extra.browser_geo_lat !== null
              ? <span key="blat" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/95 text-slate-100 font-mono text-[11px] border border-slate-800 shadow-inner tabular-nums">{extra.browser_geo_lat.toFixed(6)}°</span>
              : null],
            ['خط الطول (Longitude)', extra.browser_geo_lon !== null
              ? <span key="blon" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/95 text-slate-100 font-mono text-[11px] border border-slate-800 shadow-inner tabular-nums">{extra.browser_geo_lon.toFixed(6)}°</span>
              : null],
            ['رمز خطأ الجيولوجيشن', extra.browser_geo_error_code !== null
              ? <div key="berr" className="text-left w-full">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 text-amber-900 font-mono text-[11px] border border-amber-200/80 shadow-sm shadow-amber-900/5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-black">ERR_{String(extra.browser_geo_error_code).padStart(2, '0')}</span>
                  </span>
                  {geoErrorLabel(extra.browser_geo_error_code) && (
                    <div className="mt-1.5 text-[11px] text-amber-800 font-semibold leading-snug pr-1">{geoErrorLabel(extra.browser_geo_error_code)}</div>
                  )}
                </div>
              : null],
            ['العرض على خرائط Google', buildGeoButton(browserMapsUrl, extra.browser_geo_lat !== null && extra.browser_geo_lon !== null, { from: 'from-rose-500', to: 'to-pink-600', label: 'فتح الموقع الدقيق' })],
          ],
    },

    // 🔵 LAYER B: IP-BASED APPROXIMATE GEOLOCATION
    {
      title: 'الموقع التقريبي · عبر الـ IP',
      icon: Globe2,
      header: {
        from: 'from-sky-500',
        via: 'via-blue-500',
        to: 'to-sky-600',
        text: 'text-white',
        ring: 'ring-sky-500/20',
        glow: 'shadow-sky-500/15',
      },
      button: {
        from: 'from-sky-500',
        to: 'to-blue-600',
        label: 'عرض على الخريطة',
      },
      items: compact
        ? [
            ['الدولة', extra.country_name
              ? <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-sky-50 text-sky-800 font-bold text-[11px] border border-sky-200/60">
                  <span className="text-base leading-none filter drop-shadow-sm">{countryFlagEmoji(extra.country_code)}</span>
                  {extra.country_name}
                  {extra.country_code && <span className="text-[10px] text-sky-500 font-black">({extra.country_code})</span>}
                </span>
              : null],
            ['المنطقة / المدينة', [extra.region, extra.city, extra.zip].filter(Boolean).join(' · ') || null],
            ['الإحداثيات', (extra.lat !== null && extra.lon !== null)
              ? <span key="c2" className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900 text-slate-100 font-mono text-[10.5px] border border-slate-800 shadow-inner tabular-nums">{extra.lat.toFixed(5)}, {extra.lon.toFixed(5)}</span>
              : null],
            ['مزود الإنترنت', [extra.isp, extra.org].filter(Boolean).join(' · ') || null],
            ['المنطقة الزمنية', extra.geo_timezone
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-[10.5px] border border-indigo-200/60">
                  <Clock className="w-3 h-3" />
                  {extra.geo_timezone}
                </span>
              : null],
            ['خرائط Google', buildGeoButton(ipMapsUrl, extra.lat !== null && extra.lon !== null, { from: 'from-sky-500', to: 'to-blue-600', label: 'موقع تقريبي' })],
          ]
        : [
            ['الدولة', extra.country_name
              ? <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-br from-sky-50 via-blue-50 to-sky-50 text-sky-900 font-bold text-[11.5px] border border-sky-200/70 shadow-sm shadow-sky-900/5">
                  <span className="text-lg leading-none filter drop-shadow-sm">{countryFlagEmoji(extra.country_code)}</span>
                  <span>{extra.country_name}</span>
                  {extra.country_code && <span className="text-[10.5px] text-sky-600 font-black bg-white/60 px-1.5 py-0.5 rounded-lg border border-sky-200/60">{extra.country_code}</span>}
                </span>
              : null],
            ['المنطقة', extra.region
              ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white text-slate-800 font-semibold text-[11px] border border-slate-200/80 shadow-sm">{extra.region}</span>
              : null],
            ['المدينة', extra.city
              ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white text-slate-800 font-semibold text-[11px] border border-slate-200/80 shadow-sm">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {extra.city}
                </span>
              : null],
            ['الرمز البريدي', extra.zip
              ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-violet-50 text-violet-800 font-mono font-bold text-[11px] border border-violet-200/70">{extra.zip}</span>
              : null],
            ['خطوط الطول والعرض', (extra.lat !== null && extra.lon !== null)
              ? <span key="ipc" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/95 text-slate-100 font-mono text-[11px] border border-slate-800 shadow-inner tabular-nums">{extra.lat.toFixed(5)}, {extra.lon.toFixed(5)}</span>
              : null],
            ['مزود الإنترنت (ISP)', extra.isp
              ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white text-slate-800 font-semibold text-[11px] border border-slate-200/80 shadow-sm">
                  <Wifi className="w-3 h-3 text-slate-500" />
                  {extra.isp}
                </span>
              : null],
            ['الجهة / الشركة', extra.org
              ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50 text-teal-800 font-semibold text-[11px] border border-teal-200/70">{extra.org}</span>
              : null],
            ['المنطقة الزمنية', extra.geo_timezone
              ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-indigo-50 text-indigo-900 font-semibold text-[11px] border border-indigo-200/70 shadow-sm shadow-indigo-900/5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  {extra.geo_timezone}
                </span>
              : null],
            ['عرض على الخريطة', buildGeoButton(ipMapsUrl, extra.lat !== null && extra.lon !== null, { from: 'from-sky-500', to: 'to-blue-600', label: 'فتح الموقع التقريبي' })],
          ],
    },

    // 🖥️ DEVICE + SESSION INFO
    {
      title: 'معلومات الجهاز والجلسة',
      icon: MonitorSmartphone,
      header: {
        from: 'from-emerald-500',
        via: 'via-teal-500',
        to: 'to-emerald-600',
        text: 'text-white',
        ring: 'ring-emerald-500/20',
        glow: 'shadow-emerald-500/15',
      },
      button: {
        from: 'from-emerald-500',
        to: 'to-teal-600',
        label: '',
      },
      items: compact
        ? [
            ['نوع الجهاز', log.device_type
              ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border
                  ${log.device_type === 'desktop' ? 'bg-slate-100 text-slate-800 border-slate-200' : ''}
                  ${log.device_type === 'mobile' ? 'bg-purple-50 text-purple-800 border-purple-200/70' : ''}
                  ${log.device_type === 'tablet' ? 'bg-amber-50 text-amber-800 border-amber-200/70' : ''}
                  ${log.device_type === 'bot' ? 'bg-rose-50 text-rose-800 border-rose-200/70' : ''}
                  ${!['desktop','mobile','tablet','bot'].includes(log.device_type) ? 'bg-slate-50 text-slate-600 border-slate-200' : ''}
                `}>
                  <Monitor className="w-3 h-3" />
                  {({ desktop: 'حاسوب', mobile: 'جوال', tablet: 'تابلت', bot: 'روبوت', unknown: 'غير معروف' } as any)[log.device_type] || log.device_type}
                </span>
              : null],
            ['نظام التشغيل', log.operating_system
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-slate-800 font-semibold text-[11px] border border-slate-200 shadow-sm">{log.operating_system}</span>
              : null],
            ['المتصفح', log.browser
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white text-slate-800 font-semibold text-[11px] border border-slate-200 shadow-sm">
                  <Languages className="w-3 h-3 text-slate-500" />
                  {log.browser}
                </span>
              : null],
            ['دقة الشاشة', extra.client_screen_res
              ? <span className="font-mono text-[10.5px] px-2 py-0.5 rounded-lg bg-slate-900/[0.06] text-slate-700 border border-slate-200/60 tabular-nums">{extra.client_screen_res}</span>
              : null],
            ['لغة المتصفح', extra.client_language
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 text-orange-800 font-semibold text-[10.5px] border border-orange-200/70">
                  <Languages className="w-3 h-3" />
                  {extra.client_language}
                </span>
              : null],
            ['المنطقة الزمنية', extra.client_timezone
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 font-semibold text-[10.5px] border border-cyan-200/70">
                  <Timer className="w-3 h-3" />
                  {extra.client_timezone}
                </span>
              : null],
            ['العنوان IP', log.ip_address
              ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900/95 text-slate-100 font-mono text-[10.5px] border border-slate-800 shadow-inner tabular-nums">{log.ip_address}</span>
              : null],
          ]
        : [
            ['نوع الجهاز', log.device_type
              ? <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11.5px] font-black border shadow-sm
                  ${log.device_type === 'desktop' ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 text-slate-800 border-slate-300 shadow-slate-900/5' : ''}
                  ${log.device_type === 'mobile' ? 'bg-gradient-to-br from-purple-50 via-violet-50 to-purple-50 text-purple-900 border-purple-200/80 shadow-purple-900/5' : ''}
                  ${log.device_type === 'tablet' ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 text-amber-900 border-amber-200/80 shadow-amber-900/5' : ''}
                  ${log.device_type === 'bot' ? 'bg-gradient-to-br from-rose-50 via-red-50 to-rose-50 text-rose-900 border-rose-200/80 shadow-rose-900/5' : ''}
                  ${!['desktop','mobile','tablet','bot'].includes(log.device_type) ? 'bg-slate-50 text-slate-600 border-slate-200' : ''}
                `}>
                  <Monitor className="w-4 h-4" />
                  {({ desktop: 'حاسوب شخصي', mobile: 'هاتف جوال', tablet: 'جهاز تابلت', bot: 'روبوت آلي', unknown: 'جهاز غير معروف' } as any)[log.device_type] || log.device_type}
                </span>
              : null],
            ['نظام التشغيل', log.operating_system
              ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white text-slate-800 font-bold text-[11.5px] border border-slate-200 shadow-sm shadow-slate-900/5">
                  {log.operating_system}
                </span>
              : null],
            ['اسم وإصدار المتصفح', log.browser
              ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white text-slate-800 font-bold text-[11.5px] border border-slate-200 shadow-sm shadow-slate-900/5">
                  <Languages className="w-4 h-4 text-slate-500" />
                  {log.browser}
                </span>
              : null],
            ['دقة الشاشة', extra.client_screen_res
              ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 font-mono font-bold text-[11px] border border-slate-700 shadow-inner tabular-nums">
                  <Monitor className="w-3.5 h-3.5 text-slate-400" />
                  {extra.client_screen_res}
                </span>
              : null],
            ['لغة المتصفح', extra.client_language
              ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 text-orange-900 font-bold text-[11.5px] border border-orange-200/80 shadow-sm shadow-orange-900/5">
                  <Languages className="w-4 h-4 text-orange-600" />
                  {extra.client_language}
                </span>
              : null],
            ['المنطقة الزمنية للعميل', extra.client_timezone
              ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-br from-cyan-50 via-sky-50 to-cyan-50 text-cyan-900 font-bold text-[11.5px] border border-cyan-200/80 shadow-sm shadow-cyan-900/5">
                  <Timer className="w-4 h-4 text-cyan-600" />
                  {extra.client_timezone}
                </span>
              : null],
            ['العنوان IP', log.ip_address
              ? <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 font-mono font-bold text-[11.5px] border border-slate-700 shadow-inner tabular-nums tracking-tight">
                  <Wifi className="w-4 h-4 text-slate-400" />
                  {log.ip_address}
                </span>
              : null],
            ['معرف الجلسة', log.session_id
              ? <span key="s" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-br from-violet-50 via-fuchsia-50 to-violet-50 text-violet-900 font-mono font-bold text-[11px] border border-violet-200/80 shadow-sm shadow-violet-900/5 max-w-full">
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  {String(log.session_id).slice(0, 14)}…
                </span>
              : null],
            ['كود الخطأ (إن وجد)', log.error_code
              ? <span key="ec" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-br from-red-50 via-rose-50 to-red-50 text-red-900 font-mono font-bold text-[11px] border border-red-200/80 shadow-sm shadow-red-900/5">
                  <XCircle className="w-4 h-4 text-red-600" />
                  {log.error_code}
                </span>
              : null],
          ],
    },
  ];

  return (
    <div className={`grid gap-5 ${compact ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
      {sections.map((s, sIdx) => {
        const ItemIcon = s.icon;
        const visibleItems = s.items.filter(([, v]) => v !== null && v !== undefined && v !== '');
        const isEmpty = visibleItems.length === 0;
        return (
          <div
            key={s.title}
            className="group relative overflow-hidden rounded-[24px] bg-white border border-slate-200/70 shadow-xl shadow-slate-900/[0.04] hover:shadow-2xl hover:shadow-slate-900/[0.07] hover:-translate-y-1 transition-all duration-300"
          >
            {/* Ambient gradient overlay hover */}
            <div className={`pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${s.header.from} ${s.header.via} ${s.header.to} opacity-[0.06] blur-3xl group-hover:opacity-[0.12] transition-opacity duration-500`} />

            {/* Header Strip */}
            <div className={`relative overflow-hidden px-5 py-4 bg-gradient-to-r ${s.header.from} ${s.header.via} ${s.header.to} ${s.header.text}`}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.22),transparent_55%)]" />
              <div className="relative flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-2xl bg-white/18 backdrop-blur-sm border border-white/25 shadow-lg ${s.header.glow} ring-2 ring-white/25`}>
                  <ItemIcon className="w-5 h-5 text-white drop-shadow-sm" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-[14px] leading-tight drop-shadow-sm">{s.title}</h4>
                  <div className="text-[11px] text-white/80 font-semibold mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                    {isEmpty ? 'لا توجد بيانات لهذا القسم' : `${visibleItems.length} حقل بيانات`}
                  </div>
                </div>
              </div>
              {/* Bottom shimmer line */}
              <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            </div>

            {/* Body */}
            <div className={`relative px-4 sm:px-5 py-5 ${compact ? 'py-4' : ''}`}>
              {isEmpty ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.header.from}/5 ${s.header.to}/5 border border-slate-200/60 flex items-center justify-center mb-3`}>
                    <ItemIcon className={`w-6 h-6 bg-gradient-to-br ${s.header.from} ${s.header.to} bg-clip-text text-transparent opacity-40`} />
                  </div>
                  <p className="text-[11.5px] text-slate-400 font-semibold leading-relaxed max-w-[200px]">لا توجد تفاصيل إضافية مسجلة لهذا القسم في هذا السجل.</p>
                </div>
              ) : (
                <dl className={`grid gap-y-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 gap-x-4 sm:grid-cols-2'}`}>
                  {visibleItems.map(([k, v], i) => (
                    <div
                      key={k}
                      className={`flex items-start justify-between gap-3 py-2.5 px-3 rounded-2xl transition-all duration-200 ${
                        !compact && i % 2 === 0 ? 'bg-slate-50/40 hover:bg-slate-50/80' : 'hover:bg-slate-50/60'
                      } border border-transparent hover:border-slate-200/60`}
                    >
                      <dt className="text-[10.5px] sm:text-[11px] text-slate-500 font-bold shrink-0 pt-0.5 leading-tight">
                        {k}
                      </dt>
                      <dd className="text-slate-900 font-semibold text-right break-words min-w-0 flex justify-end">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {/* Corner accent */}
            <div className={`pointer-events-none absolute bottom-3 left-3 w-10 h-10 rounded-2xl bg-gradient-to-br ${s.header.from}/[0.07] ${s.header.to}/[0.07] blur-sm`} />
          </div>
        );
      })}
    </div>
  );
}
