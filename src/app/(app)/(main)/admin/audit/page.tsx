'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Shield, Search, CalendarDays, RefreshCw, ChevronDown, ChevronUp,
  Loader2, Monitor, Globe2, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

import { EVENT_TYPES, AuditLog } from '@/lib/tracking/types';

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
  manager: 'المدير',
  receptionist: 'الاستقبال',
  housekeeping: 'هاوس كيبنج',
  accountant: 'محاسب',
  marketing: 'تسويق',
};

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

  const [limit] = useState(100);
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
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const role = (myProfile as any)?.role || null;
      setCurrentUserRole(role);

      if (role !== 'admin') {
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
      failed: logs.filter(l => l.success === false).length,
    };
  }, [logs]);

  if (accessDenied) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">وصول ممنوع</h2>
          <p className="text-gray-600 text-sm">هذه الصفحة خاصة بمسؤولي النظام فقط (الدور: Admin). دورك الحالي: {currentUserRole || 'غير محدد'}</p>
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
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">سجل نشاط النظام</h1>
              <p className="text-sm text-gray-500">Audit &amp; Access Logs — تتبع عمليات الدخول والجلسات والأحداث الحساسة</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchLogs(false)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'جارِ التحميل...' : 'تحديث'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي السجلات', value: stats.total, icon: Clock, color: 'bg-slate-50 text-slate-600 border-slate-100' },
          { label: 'اليوم', value: stats.today, icon: CalendarDays, color: 'bg-blue-50 text-blue-600 border-blue-100' },
          { label: 'تسجيلات الدخول', value: stats.logins, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          { label: 'عمليات فاشلة', value: stats.failed, icon: AlertTriangle, color: 'bg-red-50 text-red-600 border-red-100' },
        ].map(item => (
          <div key={item.label} className={`rounded-2xl border p-4 ${item.color}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs opacity-80 mb-1">{item.label}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
              <item.icon className="w-5 h-5 opacity-70" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowFilters(s => !s)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Search className="w-4 h-4" /> فلاتر البحث
          </div>
          {showFilters ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>

        {showFilters && (
          <div className="px-6 pb-6 border-t border-gray-50 space-y-4 pt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">نوع الحدث</label>
                <select
                  value={filterEventType}
                  onChange={e => setFilterEventType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                >
                  <option value="ALL">الكل</option>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">من تاريخ</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={e => setFilterFrom(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">إلى تاريخ</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={e => setFilterTo(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
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
                    placeholder="IP / بريد / متصفح / دور..."
                    className="w-full pr-10 pl-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
              >
                تصفير الفلاتر
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
              >
                تطبيق البحث
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-slate-600" />
            <p className="text-sm">جارِ تحميل سجل النشاط...</p>
          </div>
        ) : logs.length === 0 ? (
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
                <tr className="bg-gray-50 text-right border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-6 py-3.5">الوقت</th>
                  <th className="px-6 py-3.5">المستخدم</th>
                  <th className="px-6 py-3.5">الحدث</th>
                  <th className="px-6 py-3.5">الجهاز</th>
                  <th className="px-6 py-3.5">العنوان IP</th>
                  <th className="px-6 py-3.5 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const eventColor = EVENT_COLORS[log.event_type] || EVENT_COLORS.SYSTEM;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {format(new Date(log.created_at), 'dd MMM yyyy — HH:mm', { locale: ar })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{log.user_email || 'مستخدم محذوف'}</span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            {log.user_role ? ROLE_LABELS[log.user_role] || log.user_role : 'بدون دور'}
                          </span>
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
                            {log.device_type ? {
                              desktop: 'حاسوب',
                              mobile: 'جوال',
                              tablet: 'تابلت',
                              bot: 'روبوت',
                              unknown: 'غير معروف',
                            }[log.device_type] || log.device_type : '—'}
                          </div>
                          <span className="text-xs text-gray-500 mt-0.5">
                            {[log.operating_system, log.browser].filter(Boolean).join(' · ') || 'لا توجد تفاصيل'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-700">
                        {log.ip_address || '—'}
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
