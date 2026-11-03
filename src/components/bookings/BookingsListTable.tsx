'use client';

import React from 'react';
import { normalizeRegisterFilters, parseRegisterPage, registerUrl, type RegisterFilters, type RegisterCursor, type RegisterPage, type RegisterRow } from '@/lib/bookings/register';
import Link from 'next/link';
import { CalendarDays, ChevronDown, Eye, FileText, Home, Key, Printer, Search, X, ArrowRight, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import BookingQuickView from '@/components/bookings/BookingQuickView';
import ConfirmBookingButton from '@/components/bookings/ConfirmBookingButton';
import { addDays, addMonths, differenceInDays, format as formatDate, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-50 text-gray-700' },
  quoted: { label: 'عرض سعر', color: 'bg-indigo-50 text-indigo-800' },
  preliminary: { label: 'حجز أولي', color: 'bg-emerald-50 text-emerald-900 border border-emerald-200' },
  pending: { label: 'مبدئي', color: 'bg-yellow-50 text-yellow-900' },
  pending_deposit: { label: 'بانتظار العربون', color: 'bg-yellow-100 text-yellow-900' },
  deposit_paid: { label: 'تم دفع العربون', color: 'bg-lime-100 text-lime-900' },
  confirmed: { label: 'مؤكد', color: 'bg-green-100 text-green-900' },
  checked_in: { label: 'تم الدخول', color: 'bg-blue-100 text-blue-900' },
  checked_out: { label: 'تم الخروج', color: 'bg-gray-100 text-gray-900' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-900' },
  completed: { label: 'مكتمل', color: 'bg-teal-100 text-teal-900' },
};

function DatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);

  const selectedDate = React.useMemo(() => value ? new Date(`${value}T12:00:00`) : null, [value]);
  const [month, setMonth] = React.useState<Date>(() => selectedDate || new Date());

  React.useEffect(() => {
    if (!open) return;
    setMonth(selectedDate || new Date());
  }, [open, selectedDate]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (popoverRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  const monthStart = React.useMemo(() => startOfMonth(month), [month]);
  const days = React.useMemo(() => {
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [monthStart]);
  const weekDays = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

  const title = month.toLocaleDateString('ar-SA', { calendar: 'gregory', month: 'long', year: 'numeric' });

  const setValueDate = (d: Date) => {
    onChange(formatDate(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs sm:text-sm font-bold text-emerald-950">{label}</label>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full pr-10 pl-10 py-2.5 border border-emerald-200 bg-white rounded-xl text-xs sm:text-sm text-emerald-950 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-right"
        >
          {value ? (
            <span className="font-bold">{selectedDate?.toLocaleDateString('ar-SA', { calendar: 'gregory' })}</span>
          ) : (
            <span className="text-emerald-700">اختر التاريخ</span>
          )}
        </button>
        <CalendarDays size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-700 pointer-events-none" />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-emerald-700 hover:bg-emerald-50"
            title="مسح"
          >
            <X size={14} />
          </button>
        ) : null}

        {open ? (
          <div
            ref={popoverRef}
            className="absolute z-50 mt-2 w-full min-w-[280px] rounded-2xl border border-emerald-200 bg-white shadow-xl overflow-hidden"
          >
            <div className="bg-gradient-to-l from-emerald-700 via-emerald-800 to-emerald-900 px-3 py-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, -1))}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              >
                السابق
              </button>
              <div className="text-white font-extrabold text-xs sm:text-sm">{title}</div>
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              >
                التالي
              </button>
            </div>

            <div className="p-3 bg-emerald-50">
              <div className="grid grid-cols-7 gap-1 text-[10px] font-extrabold text-emerald-900 mb-2">
                {weekDays.map((d) => (
                  <div key={d} className="text-center">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const inMonth = isSameMonth(d, monthStart);
                  const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
                  const cls = isSelected
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : inMonth
                      ? 'bg-white text-emerald-950 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-white text-emerald-400 border-emerald-100 hover:bg-emerald-50';
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => setValueDate(d)}
                      className={`h-9 rounded-xl border text-xs font-bold transition-colors ${cls}`}
                    >
                      {formatDate(d, 'd')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function BookingsListTable({ selectedHotelId, pageSize = 5, initialFilters, initialPage, initialError }: {
  selectedHotelId: string; pageSize?: number; initialFilters?: RegisterFilters; initialPage?: RegisterPage | null; initialError?: string | null;
}) {
  const [filters, setFilters] = React.useState(() => normalizeRegisterFilters(initialFilters || {}));
  const { status, type, arrival, departure, q, contract: contractStatus } = filters;
  const [queryInput, setQueryInput] = React.useState(filters.q);
  const [navigation, setNavigation] = React.useState<{ cursor: RegisterCursor | null; direction: 'next' | 'previous'; page: number }>({ cursor: null, direction: 'next', page: 1 });
  const [snapshot, setSnapshot] = React.useState<RegisterPage | null>(initialPage || null);
  const [error, setError] = React.useState<string | null>(initialError || null);
  const [loading, setLoading] = React.useState(!initialPage && !initialError);
  const [revision, setRevision] = React.useState(0);
  const requestRef = React.useRef<AbortController | null>(null);
  const generationRef = React.useRef(0);
  const bootstrapRef = React.useRef(Boolean(initialPage || initialError));
  const filterKey = JSON.stringify([selectedHotelId, pageSize, filters]);
  const viewKey = JSON.stringify([filterKey, navigation]);
  const [loadedKey, setLoadedKey] = React.useState(initialPage ? viewKey : '');
  const countRef = React.useRef<{ key: string; count: number | null }>({ key: filterKey, count: initialPage?.totalCount ?? null });
  const awaitingQuery = queryInput.trim() !== q;
  const filtersRef = React.useRef(filters);
  const navigationRef = React.useRef(navigation);
  filtersRef.current = filters;
  navigationRef.current = navigation;
  const pageNum = navigation.page;
  const rows: RegisterRow[] = !awaitingQuery && loadedKey === viewKey ? snapshot?.rows || [] : [];
  const totalCount = countRef.current.key === filterKey ? countRef.current.count : null;
  const hasNext = loadedKey === viewKey && Boolean(snapshot?.hasNext);
  const hasPrevious = loadedKey === viewKey && Boolean(snapshot?.hasPrevious);

  const updateFilters = React.useCallback((patch: Partial<RegisterFilters>) => {
    const next = normalizeRegisterFilters({ ...filtersRef.current, ...patch });
    if (JSON.stringify(next) === JSON.stringify(filtersRef.current) && !navigationRef.current.cursor && navigationRef.current.page === 1) return;
    filtersRef.current = next;
    requestRef.current?.abort();
    generationRef.current++;
    setError(null);
    setLoading(true);
    setFilters(next);
    setNavigation({ cursor: null, direction: 'next', page: 1 });
  }, []);
  const setStatus = (value: string) => updateFilters({ status: value });
  const setType = (value: string) => updateFilters({ type: value });
  const setArrival = (value: string) => updateFilters({ arrival: value });
  const setDeparture = (value: string) => updateFilters({ departure: value });
  const setContractStatus = (value: string) => updateFilters({ contract: value });

  React.useEffect(() => {
    if (queryInput.trim() === q) return;
    requestRef.current?.abort();
    generationRef.current++;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => updateFilters({ q: queryInput }), 300);
    return () => window.clearTimeout(timer);
  }, [queryInput, q, updateFilters]);

  React.useEffect(() => {
    const url = registerUrl(filters);
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(window.history.state, '', url);
  }, [filters]);
  React.useEffect(() => {
    const onBack = () => {
      const values = Object.fromEntries(new URLSearchParams(window.location.search));
      const next = normalizeRegisterFilters(values);
      setQueryInput(next.q);
      updateFilters(next);
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, [updateFilters]);

  React.useEffect(() => {
    if (bootstrapRef.current) { bootstrapRef.current = false; return; }
    if (awaitingQuery) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const generation = ++generationRef.current;
    let timedOut = false;
    let active = true;
    const current = () => active && generation === generationRef.current;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    const includeCount = countRef.current.key !== filterKey || countRef.current.count === null;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const response = await Promise.race([
          Promise.resolve(supabase.rpc('get_bookings_register_page', {
            p_filters: { ...filters, hotel: selectedHotelId }, p_cursor: navigation.cursor,
            p_direction: navigation.direction, p_page_size: pageSize, p_include_count: includeCount,
          }).abortSignal(controller.signal)),
          new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error(timedOut ? 'timeout' : 'aborted')), { once: true })),
        ]);
        if (!current()) return;
        if (response.error) throw response.error;
        const next = parseRegisterPage(response.data);
        // Rows can disappear while another user edits the register. Recover to
        // the first page instead of trapping navigation on an empty cursor page.
        if (next.rows.length === 0 && navigation.cursor) {
          countRef.current = { key: filterKey, count: null };
          setNavigation({ cursor: null, direction: 'next', page: 1 });
          return;
        }
        if (next.totalCount !== null) countRef.current = { key: filterKey, count: next.totalCount };
        setSnapshot(next);
        setLoadedKey(viewKey);
      } catch {
        if (!current() || (controller.signal.aborted && !timedOut)) return;
        setError(timedOut ? 'استغرق تحميل النتائج وقتًا أطول من المعتاد. أعد المحاولة.' : 'تعذر تحميل نتائج الحجوزات. تحقق من الاتصال ثم أعد المحاولة.');
      } finally {
        window.clearTimeout(timer);
        if (current()) setLoading(false);
      }
    };
    void load();
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [filterKey, viewKey, awaitingQuery, revision, filters, navigation.cursor, navigation.direction, pageSize, selectedHotelId]);

  const reload = () => {
    bootstrapRef.current = false;
    requestRef.current?.abort();
    generationRef.current++;
    countRef.current = { key: filterKey, count: null };
    setLoading(true);
    setError(null);
    setRevision(value => value + 1);
  };
  const goPage = (direction: 'next' | 'previous') => {
    const cursor = direction === 'next' ? snapshot?.nextCursor : snapshot?.previousCursor;
    if (!cursor) return;
    requestRef.current?.abort();
    generationRef.current++;
    setLoading(true);
    setError(null);
    setNavigation({ cursor, direction, page: Math.max(1, pageNum + (direction === 'next' ? 1 : -1)) });
  };
  const ejarBadge = (ejar: NonNullable<(typeof rows)[number]['ejar']>) => {
    const s = ejar.status;
    const needsDoc = s === 'confirmed' && String(ejar.supervisor_note || '').trim() !== 'تم توثيق';
    const base = ejar.decided_at || ejar.updated_at || ejar.uploaded_at || ejar.created_at || null;
    const remaining = (() => {
      if (!needsDoc || !base) return null;
      const decidedAt = new Date(String(base));
      if (Number.isNaN(decidedAt.getTime())) return null;
      const decidedDay = new Date(decidedAt);
      decidedDay.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const elapsed = Math.max(0, differenceInDays(today, decidedDay));
      return Math.max(0, 7 - elapsed);
    })();

    const label =
      s === 'rejected'
        ? 'إيجار: لم يوافق'
        : s === 'pending_confirmation'
          ? 'إيجار: بانتظار التأكيد'
          : needsDoc
            ? `إيجار: بانتظار التوثيق${typeof remaining === 'number' ? ` • متبقي ${remaining} يوم` : ''}`
            : 'إيجار: تم التأكيد';

    const cls =
      s === 'rejected'
        ? 'bg-red-100 text-red-900'
        : s === 'pending_confirmation'
          ? 'bg-amber-100 text-amber-900'
          : needsDoc
            ? 'bg-amber-100 text-amber-900'
            : 'bg-emerald-100 text-emerald-900';
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${cls}`}>{label}</span>;
  };

  const canPrev = hasPrevious;
  const canNext = hasNext;
  const totalPages = typeof totalCount === 'number' ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  // Booking indicator component
  const BookingIndicator = ({ row }: { row: typeof rows[0] }) => {
    let color = 'bg-gray-400';
    if (row.hasEjarUpload) {
      color = 'bg-green-500';
    } else if (row.hasAdditionalServices) {
      color = 'bg-red-500';
    }

    return (
      <div
        className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`}
        title={
          row.hasEjarUpload
            ? 'تم رفع العقد إلى منصة إيجار'
            : row.hasAdditionalServices
              ? 'يوجد إضافات على الفاتورة'
              : 'لا يوجد رفع إيجار ولا إضافات'
        }
      />
    );
  };

  return (
    <div className="space-y-3">
      <div role="group" aria-label="تصفية حالة الحجز" className="flex flex-wrap gap-2">
        {[['all','الكل'],['pending_deposit','بانتظار العربون'],['confirmed','مؤكد'],['checked_in','تم الدخول'],['checked_out','تم الخروج'],['cancelled','ملغي']].map(([value,label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`min-h-10 rounded-xl border px-3 text-xs font-semibold ${status === value ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>{label}</button>)}
      </div>
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-visible relative z-30">
        <div className="bg-gradient-to-l from-emerald-700 via-emerald-800 to-emerald-900 px-3 sm:px-4 py-2.5 flex items-center justify-between">
          <div className="text-white font-extrabold text-xs sm:text-sm">بحث وتصفية</div>
          <button type="button" disabled={loading || awaitingQuery} onClick={reload} className="min-h-9 rounded-lg border border-white/30 px-3 text-[11px] font-semibold text-white hover:bg-white/10 disabled:opacity-60">{loading || awaitingQuery ? 'جاري التحديث…' : 'تحديث النتائج'}</button>
        </div>
        <div className="p-3 sm:p-4 bg-emerald-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-emerald-950">بحث</label>
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-700" />
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => {

                    setQueryInput(e.target.value.slice(0, 200));
                  }}
                  placeholder="اسم العميل، جوال، رقم وحدة"
                  className="w-full pr-10 pl-3 py-2.5 border border-emerald-200 bg-white rounded-xl text-xs sm:text-sm text-emerald-950 placeholder:text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <DatePicker
              label="تاريخ الوصول"
              value={arrival}
              onChange={(v) => {

                setArrival(v);
              }}
            />

            <DatePicker
              label="تاريخ المغادرة"
              value={departure}
              onChange={(v) => {

                setDeparture(v);
              }}
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-emerald-950">الحالة</label>
                <div className="relative">
                  <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700 pointer-events-none" />
                  <select
                    value={status}
                    onChange={(e) => {

                      setStatus(e.target.value);
                    }}
                    className="w-full pr-3 pl-9 py-2.5 border border-emerald-200 bg-white rounded-xl text-xs sm:text-sm text-emerald-950 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none appearance-none"
                  >
                    <option value="all">كل الحالات</option>
                    <option value="active">حجوزات نشطة حالياً</option>
                    <option value="pending_deposit">بانتظار العربون</option>
                    <option value="confirmed">مؤكد</option>
                    <option value="checked_in">تم الدخول</option>
                    <option value="checked_out">تم الخروج</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-emerald-950">النوع</label>
                <div className="relative">
                  <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700 pointer-events-none" />
                  <select
                    value={type}
                    onChange={(e) => {

                      setType(e.target.value);
                    }}
                    className="w-full pr-3 pl-9 py-2.5 border border-emerald-200 bg-white rounded-xl text-xs sm:text-sm text-emerald-950 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none appearance-none"
                  >
                    <option value="all">كل الأنواع</option>
                    <option value="daily">يومي</option>
                    <option value="monthly">شهري</option>
                    <option value="yearly">سنوي</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-emerald-950">حالة العقد</label>
              <div className="relative">
                <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700 pointer-events-none" />
                <select
                  value={contractStatus}
                  onChange={(e) => {

                    setContractStatus(e.target.value);
                  }}
                  className="w-full pr-3 pl-9 py-2.5 border border-emerald-200 bg-white rounded-xl text-xs sm:text-sm text-emerald-950 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none appearance-none"
                >
                  <option value="all">كل الحجوزات</option>
                  <option value="ejar_uploaded">مرفوع إلى منصة إيجار</option>
                  <option value="additional_services">لديه إضافات على الفاتورة</option>
                  <option value="none">بدون إضافات ولا رفع إيجار</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"><span>{error}</span><button type="button" onClick={reload} className="min-h-10 rounded-lg border border-red-200 bg-white px-3 font-semibold">إعادة المحاولة</button></div>}
      <div aria-busy={loading || awaitingQuery} className="bg-white rounded-2xl shadow-sm border border-emerald-300 overflow-hidden">
        {(loading || awaitingQuery) && <div role="status" aria-live="polite" className="flex items-center gap-2 border-b border-stone-100 p-3 text-xs text-emerald-800"><span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-800 motion-reduce:animate-none" />جاري تحميل الحجوزات…</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] sm:text-sm text-right">
            <thead className="bg-gradient-to-l from-emerald-700 via-emerald-800 to-emerald-900 border-b border-emerald-950 text-white font-bold">
              <tr>
                <th className="px-2 sm:px-6 py-2 sm:py-4 w-10"></th>
                <th className="px-2 sm:px-6 py-2 sm:py-4">رقم الحجز</th>
                <th className="px-2 sm:px-6 py-2 sm:py-4">العميل</th>
                <th className="px-2 sm:px-6 py-2 sm:py-4">الوحدة</th>
                <th className="px-2 sm:px-6 py-2 sm:py-4">الوصول</th>
                <th className="hidden sm:table-cell px-2 sm:px-6 py-2 sm:py-4">المغادرة</th>
                <th className="px-2 sm:px-6 py-2 sm:py-4">الحالة</th>
                <th className="px-2 sm:px-6 py-2 sm:py-4">المبلغ</th>
                <th className="px-2 sm:px-6 py-2 sm:py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {rows.map((r) => {
                const b = r.booking;
                const statusInfo = STATUS_MAP[b.status] || { label: b.status, color: 'bg-gray-100 text-gray-900' };
                return (
                  <tr key={b.id} className="hover:bg-emerald-50 transition-colors">
                    <td className="px-1 sm:px-6 py-1 sm:py-4">
                      <BookingIndicator row={r} />
                    </td>
                    <td className="px-1 sm:px-6 py-1 sm:py-4 font-mono font-bold text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-800">
                          <span className="sm:hidden">#{String(b.id).slice(0, 6).toUpperCase()}</span>
                          <span className="hidden sm:inline">#{String(b.id).slice(0, 8).toUpperCase()}</span>
                        </span>
                        {r.hasKey ? (
                          <div title="يوجد مفتاح ذكي" className="bg-emerald-200 text-emerald-900 p-1 rounded-md">
                            <Key size={12} />
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-1 sm:px-6 py-1 sm:py-4">
                      <div className="font-bold text-gray-900">{b.customer?.full_name || 'غير معروف'}</div>
                      <div className="text-[9px] sm:text-xs text-gray-500 font-mono" dir="ltr">
                        {b.customer?.phone || '-'}
                      </div>
                    </td>
                    <td className="px-1 sm:px-6 py-1 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Home size={14} className="text-gray-400" />
                        <span className="font-medium text-gray-900">{b.unit?.unit_number || '-'}</span>
                        <span className="text-gray-500 text-[10px] sm:text-xs">({b.unit?.unit_type?.name || '-'})</span>
                      </div>
                    </td>
                    <td className="px-1 sm:px-6 py-1 sm:py-4 font-medium text-gray-900 whitespace-nowrap">
                      <span className="sm:hidden">{String(b.check_in || '').slice(8, 10)}/{String(b.check_in || '').slice(5, 7)}</span>
                      <span className="hidden sm:inline">{String(b.check_in || '').split('T')[0]}</span>
                    </td>
                    <td className="hidden sm:table-cell px-2 sm:px-6 py-2 sm:py-4 font-medium text-gray-900 whitespace-nowrap">
                      {String(b.check_out || '').split('T')[0]}
                    </td>
                    <td className="px-1 sm:px-6 py-1 sm:py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      {r.ejar ? <div className="mt-1">{ejarBadge(r.ejar)}</div> : null}
                    </td>
                    <td className="px-1 sm:px-6 py-1 sm:py-4 font-bold text-gray-900 whitespace-nowrap">{Number(r.amount || 0).toLocaleString()} ر.س</td>
                    <td className="px-1 sm:px-6 py-1 sm:py-4">
                      <div className="flex items-center justify-center gap-2">
                        <BookingQuickView id={b.id} />
                        {['preliminary', 'pending', 'pending_deposit', 'deposit_paid'].includes(b.status) ? (
                          <Link
                            href={`/bookings?complete_booking=${encodeURIComponent(b.id)}`}
                            className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-l from-emerald-700 via-emerald-800 to-emerald-900 hover:from-emerald-800 hover:to-emerald-950 text-white rounded-lg text-[10px] sm:text-xs font-extrabold shadow-sm hover:shadow-md transition-all"
                            title="إكمال إجراءات الحجز (الفاتورة + العقد + المحاسبة)"
                          >
                            <Zap size={13} className="sm:hidden group-hover:scale-110 transition-transform" />
                            <Zap size={15} className="hidden sm:inline group-hover:scale-110 transition-transform" />
                            <span className="hidden md:inline">إكمال الإجراءات</span>
                            <ArrowRight size={12} className="hidden sm:inline" />
                          </Link>
                        ) : null}
                        {b.status !== 'confirmed' && !['preliminary', 'pending', 'pending_deposit', 'deposit_paid'].includes(b.status) ? <ConfirmBookingButton id={b.id} onConfirmed={reload} /> : null}
                        <Link
                          href={`/print/invoice/${b.id}`}
                          target="_blank"
                          className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="الفاتورة"
                        >
                          <FileText size={16} className="sm:hidden" />
                          <FileText size={18} className="hidden sm:inline" />
                        </Link>
                        <Link
                          href={`/print/contract/${b.id}`}
                          target="_blank"
                          className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="العقد"
                        >
                          <Printer size={16} className="sm:hidden" />
                          <Printer size={18} className="hidden sm:inline" />
                        </Link>
                        <Link
                          href={`/bookings-list/${b.id}`}
                          className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="تفاصيل الحجز"
                        >
                          <Eye size={16} className="sm:hidden" />
                          <Eye size={18} className="hidden sm:inline" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !awaitingQuery && !error && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 sm:px-6 py-10 sm:py-12 text-center text-gray-500 font-medium text-xs sm:text-sm">
                    لا توجد حجوزات مطابقة
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-6 py-3 border-t border-emerald-950 bg-gradient-to-l from-emerald-700 via-emerald-800 to-emerald-900">
          <div className="text-[10px] sm:text-xs text-white font-bold">
            الصفحة {pageNum}
            {typeof totalCount === 'number' ? ` من ${totalPages}` : ''}
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => goPage('previous')}
              disabled={!canPrev || loading}
              className={`px-2 py-1 sm:px-3 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-bold border transition-colors ${
                canPrev && !loading ? 'bg-white hover:bg-emerald-50 text-emerald-900 border-white' : 'bg-emerald-900 text-white/50 border-emerald-900 cursor-not-allowed'
              }`}
            >
              السابق
            </button>
            <button
              type="button"
              onClick={() => goPage('next')}
              disabled={!canNext || loading}
              className={`px-2 py-1 sm:px-3 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-sm font-bold border transition-colors ${
                canNext && !loading ? 'bg-white hover:bg-emerald-50 text-emerald-900 border-white' : 'bg-emerald-900 text-white/50 border-emerald-900 cursor-not-allowed'
              }`}
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
