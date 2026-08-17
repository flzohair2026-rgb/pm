'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';
import {
  FileText,
  FileSpreadsheet,
  FileCheck2,
  FileKey,
  ClipboardList,
  LogOut,
  Search,
  X,
  Calendar,
  Clock,
  Building2,
  User,
  Phone,
  Download,
  Link2,
  Trash2,
  FolderArchive,
  RefreshCw,
  Filter,
  Hash,
  Sparkles,
  IdCard,
  FileImage,
  FileIcon
} from 'lucide-react';

export default function DocumentsArchivePage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterType, setFilterType] = useState<string>('');
  const [filterUnit, setFilterUnit] = useState<string>('');
  const [filterCustomerName, setFilterCustomerName] = useState<string>('');
  const [filterBookingId, setFilterBookingId] = useState<string>('');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterFromTime, setFilterFromTime] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');
  const [filterToTime, setFilterToTime] = useState<string>('');

  const { role } = useUserRole();
  const listSeqRef = useRef(0);
  const today = useMemo(() => format(new Date(), 'dd/MM/yyyy', { locale: ar }), []);

  const refreshList = async () => {
    const mySeq = ++listSeqRef.current;
    setLoading(true);
    try {
      let dateFromISO: string | null = null;
      let dateToISO: string | null = null;
      if (filterFrom) {
        const t = filterFromTime || '00:00';
        dateFromISO = `${filterFrom}T${t}:00`;
      }
      if (filterTo) {
        const t = filterToTime || '23:59';
        dateToISO = `${filterTo}T${t}:59`;
      }
      const body = {
        doc_type: filterType || null,
        unit_number: filterUnit || null,
        customer_name: filterCustomerName || null,
        booking_id: filterBookingId || null,
        date_from: dateFromISO,
        date_to: dateToISO,
        query: filterQuery || null
      };
      const res = await fetch('/api/documents/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) return;
      const data = await res.json();
      if (mySeq === listSeqRef.current) {
        setList(data?.documents || []);
      }
    } finally {
      if (mySeq === listSeqRef.current) setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (!['admin', 'manager', 'super_admin'].includes(role || '')) return;
    const confirmDel = confirm('هل أنت متأكد من حذف هذه الوثيقة؟ لا يمكن التراجع.');
    if (!confirmDel) return;
    try {
      const res = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        const msg = data?.deletedAll
          ? 'تم حذف الوثيقة وكل النسخ المرتبطة بها'
          : (data?.storageOk ? 'تم حذف الوثيقة بنجاح' : 'تم حذف السجل، تعذر حذف الملف من التخزين');
        alert(msg);
        setList((prev) => prev.filter((x) => x.id !== id));
      } else {
        alert(`فشل الحذف: ${data?.error || 'سبب غير معروف'}`);
      }
    } catch {
      alert(`فشل الحذف: خطأ شبكة`);
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterUnit('');
    setFilterCustomerName('');
    setFilterBookingId('');
    setFilterQuery('');
    setFilterFrom('');
    setFilterFromTime('');
    setFilterTo('');
    setFilterToTime('');
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(
      () => alert('تم نسخ الرابط إلى الحافظة'),
      () => alert('تعذر النسخ')
    );
  };

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    const t = setTimeout(() => {
      refreshList();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterUnit, filterCustomerName, filterBookingId, filterQuery, filterFrom, filterFromTime, filterTo, filterToTime]);

  const hasAnyFilter = useMemo(() => {
    return !!(filterType || filterUnit || filterCustomerName || filterBookingId || filterQuery || filterFrom || filterTo);
  }, [filterType, filterUnit, filterCustomerName, filterBookingId, filterQuery, filterFrom, filterTo]);

  const counts = useMemo(() => {
    const byType: Record<string, number> = {};
    list.forEach(d => { byType[d.doc_type] = (byType[d.doc_type] || 0) + 1; });
    const withBooking = list.filter(d => !!d.booking_id).length;
    const withUnit = list.filter(d => !!d.unit_number).length;
    return { total: list.length, byType, withBooking, withUnit };
  }, [list]);

  return (
    <div dir="rtl" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* الهيدر */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-900/20">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              أرشيف الوثائق
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                {counts.total} وثيقة
              </span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              التاريخ: {today}
              {counts.withBooking > 0 && (
                <span className="text-teal-700">· {counts.withBooking} مرتبطة بحجز</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyFilter && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm hover:bg-gray-50 shadow-sm"
            >
              <X className="w-4 h-4" />
              مسح الفلاتر
            </button>
          )}
          <button
            onClick={refreshList}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-700 text-white text-sm font-medium shadow-lg shadow-emerald-900/20 hover:shadow-xl disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات السريعة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="إجمالي الوثائق" value={counts.total.toString()} icon={<FileText className="w-5 h-5" />} gradient="from-emerald-500 to-teal-600" />
        <StatCard label="مرتبطة بحجز" value={counts.withBooking.toString()} icon={<Hash className="w-5 h-5" />} gradient="from-amber-500 to-orange-600" />
        <StatCard label="لها رقم غرفة" value={counts.withUnit.toString()} icon={<Building2 className="w-5 h-5" />} gradient="from-sky-500 to-blue-600" />
        <StatCard label="عقود" value={(counts.byType['contract'] || 0).toString()} icon={<FileKey className="w-5 h-5" />} gradient="from-rose-500 to-pink-600" />
      </div>

      {/* شريط الفلاتر */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.08)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
            <Filter className="w-4 h-4 text-emerald-600" />
            فلاتر الأرشيف
          </div>
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              جاري البحث...
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-right">
          <div>
            <label className="block text-xs mb-1 text-gray-500 font-medium">نوع الوثيقة</label>
            <div className="relative">
              <FileText className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pr-10 pl-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              >
                <option value="">الكل ({counts.total})</option>
                <option value="voucher">سند ({counts.byType['voucher'] || 0})</option>
                <option value="invoice">فاتورة ({counts.byType['invoice'] || 0})</option>
                <option value="statement">كشف حساب ({counts.byType['statement'] || 0})</option>
                <option value="contract">عقد ({counts.byType['contract'] || 0})</option>
                <option value="handover">استلام ({counts.byType['handover'] || 0})</option>
                <option value="return">تسليم ({counts.byType['return'] || 0})</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1 text-gray-500 font-medium">رقم الشقة / الغرفة</label>
            <div className="relative">
              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                placeholder="مثال: 204 أو 12B"
                className="w-full border border-gray-200 rounded-xl pr-10 pl-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1 text-gray-500 font-medium">رقم الحجز</label>
            <div className="relative">
              <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={filterBookingId}
                onChange={(e) => setFilterBookingId(e.target.value)}
                placeholder="ID الحجز"
                className="w-full border border-gray-200 rounded-xl pr-10 pl-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1 text-gray-500 font-medium">اسم العميل</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={filterCustomerName}
                onChange={(e) => setFilterCustomerName(e.target.value)}
                placeholder="ابحث باسم العميل"
                className="w-full border border-gray-200 rounded-xl pr-10 pl-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1 text-gray-500 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> من تاريخ
            </label>
            <div className="grid grid-cols-5 gap-2">
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="col-span-3 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              />
              <input
                type="time"
                value={filterFromTime}
                onChange={(e) => setFilterFromTime(e.target.value)}
                className="col-span-2 border border-gray-200 rounded-xl px-2 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1 text-gray-500 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> إلى تاريخ
            </label>
            <div className="grid grid-cols-5 gap-2">
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="col-span-3 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              />
              <input
                type="time"
                value={filterToTime}
                onChange={(e) => setFilterToTime(e.target.value)}
                className="col-span-2 border border-gray-200 rounded-xl px-2 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs mb-1 text-gray-500 font-medium flex items-center gap-1">
              <Search className="w-3.5 h-3.5" /> بحث عام
              <span className="text-gray-400 font-normal">(الاسم · الهاتف · الغرفة · النوع · المسار)</span>
            </label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="اكتب كلمة بحث..."
                className="w-full border border-gray-200 rounded-xl pr-10 pl-10 py-2.5 text-sm bg-gray-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* شبكة بطاقات الوثائق */}
      <div>
        {loading && list.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm h-64 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-7 w-20 rounded-lg bg-gray-100" />
                  <div className="h-7 w-24 rounded-lg bg-gray-100" />
                </div>
                <div className="h-14 rounded-2xl bg-gray-50 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-100" />
                  <div className="h-4 w-1/2 rounded bg-gray-100" />
                  <div className="h-4 w-2/3 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm py-16 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-50 to-gray-100 mx-auto flex items-center justify-center mb-4">
              <FolderArchive className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">لا توجد وثائق مطابقة</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {hasAnyFilter
                ? 'جرّب تعديل شروط الفلترة أو مسحها لإظهار كل الوثائق المرفوعة من صفحة تفاصيل الحجز وغيرها.'
                : 'لم يتم رفع أي وثائق حتى الآن. أي ملف ترفعه من صفحة تفاصيل الحجز سيظهر هنا تلقائياً.'}
            </p>
            {hasAnyFilter && (
              <button
                onClick={clearFilters}
                className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-900/10"
              >
                <X className="w-4 h-4" /> مسح الفلاتر
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map((d) => (
              <DocCard
                key={d.id}
                doc={d}
                role={role || ''}
                onDelete={handleDelete}
                onCopyLink={copyLink}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================= بطاقة الإحصائيات ========================= */
function StatCard({ label, value, icon, gradient }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className="group bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className="text-right flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ========================= بطاقة الوثيقة ========================= */
function DocCard({ doc, role, onDelete, onCopyLink }: {
  doc: any;
  role: string;
  onDelete: (id: string) => void;
  onCopyLink: (url: string) => void;
}) {
  const meta = getDocMeta(doc.doc_type, doc.content_type);
  const hasBooking = !!doc.booking_id;
  const hasUnit = !!doc.unit_number;
  const hasCustomer = !!doc.customer_full_name;
  const isImage = /^image\//.test(doc.content_type || '');

  return (
    <div className="group relative bg-white rounded-3xl border border-gray-100 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.15)] overflow-hidden hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300">
      {/* الشريط الملون العلوي حسب النوع */}
      <div className={`h-1.5 w-full bg-gradient-to-l ${meta.gradient}`} />

      {/* مصغرة صورة / مكانها */}
      <div className={`relative h-40 bg-gradient-to-br ${meta.gradientBg} border-b border-gray-100 overflow-hidden`}>
        {isImage && doc.public_url ? (
          <img
            src={doc.public_url}
            alt={meta.label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className={`w-16 h-20 rounded-2xl bg-white/70 backdrop-blur-sm shadow-lg flex items-center justify-center border border-white/50`}>
              {meta.icon}
            </div>
          </div>
        )}

        {/* شارة النوع */}
        <div className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl ${meta.badgeClass} text-xs font-semibold shadow-sm backdrop-blur-sm`}>
          {meta.smallIcon}
          {meta.label}
        </div>

        {/* شارة الحجز إن وجد */}
        {hasBooking && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/90 text-gray-800 text-xs font-semibold shadow-sm backdrop-blur-sm border border-white">
            <Hash className="w-3 h-3 text-amber-600" />
            <span className="font-mono">
              {doc.booking_id.length > 10 ? doc.booking_id.slice(0, 8) + '…' : doc.booking_id}
            </span>
          </div>
        )}

        {/* شارة الغرفة إن وجدت */}
        {hasUnit && (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/85 text-white text-xs font-semibold shadow-sm backdrop-blur-sm">
            <Building2 className="w-3 h-3" />
            شقة {doc.unit_number}
          </div>
        )}
      </div>

      {/* المحتوى */}
      <div className="p-4 space-y-3">
        {/* العميل + التاريخ */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {hasCustomer ? (
              <>
                <div className="flex items-center gap-1.5 text-gray-900 font-semibold truncate text-sm">
                  <User className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="truncate">{doc.customer_full_name}</span>
                </div>
                {doc.customer_phone && (
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500" dir="ltr">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    {doc.customer_phone}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                <IdCard className="w-3.5 h-3.5" />
                لا يوجد عميل مرتبط
              </div>
            )}
          </div>
          <div className="text-left flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-gray-500 justify-end">
              <Calendar className="w-3 h-3 text-gray-400" />
              {format(new Date(doc.uploaded_at || doc.doc_date), 'dd/MM/yyyy', { locale: ar })}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-400 justify-end mt-0.5">
              <Clock className="w-3 h-3" />
              {format(new Date(doc.uploaded_at || doc.doc_date), 'HH:mm', { locale: ar })}
            </div>
          </div>
        </div>

        {/* نوع المستند المطلوب (إن وجد من صفحة الحجز) */}
        {doc.requested_doc_type && (
          <div className="flex items-start gap-1.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 px-3 py-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-amber-700 font-medium">مطلوب في الحجز</p>
              <p className="text-xs text-amber-900 font-semibold truncate">{doc.requested_doc_type}</p>
            </div>
          </div>
        )}

        {/* الفاصل */}
        <div className="h-px bg-gradient-to-l from-transparent via-gray-200 to-transparent" />

        {/* أزرار الحركة */}
        <div className="flex items-center gap-2 pt-0.5">
          {doc.public_url ? (
            <>
              <a
                href={doc.public_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-700 text-white text-xs font-medium shadow-md shadow-emerald-900/15 hover:shadow-lg hover:-translate-y-0.5 transition-all flex-1"
              >
                <Download className="w-3.5 h-3.5" />
                فتح / تحميل
              </a>
              <button
                onClick={() => onCopyLink(doc.public_url)}
                title="نسخ رابط الوثيقة"
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-emerald-700 hover:border-emerald-200 transition"
              >
                <Link2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <span className="flex-1 text-xs text-gray-400 text-center py-2 bg-gray-50 rounded-xl border border-gray-100">
              لا يوجد رابط عام
            </span>
          )}
          {['admin', 'manager', 'super_admin'].includes(role) && (
            <button
              onClick={() => onDelete(doc.id)}
              title="حذف الوثيقة"
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========================= أدوات مساعدة للتصنيف البصري ========================= */
function getDocMeta(type: string, contentType?: string) {
  const fallback = {
    label: 'وثيقة',
    icon: <FileText className="w-8 h-8 text-gray-500" />,
    smallIcon: <FileText className="w-3 h-3" />,
    gradient: 'from-gray-400 to-gray-500',
    gradientBg: 'from-gray-50 to-slate-100',
    badgeClass: 'bg-white/90 text-gray-700 border border-white',
  };
  const isPdf = (contentType || '').includes('pdf');
  const isImage = /^image\//.test(contentType || '');

  switch (type) {
    case 'voucher':
      return {
        label: 'سند',
        icon: <FileSpreadsheet className="w-8 h-8 text-emerald-700" />,
        smallIcon: <FileSpreadsheet className="w-3 h-3" />,
        gradient: 'from-emerald-500 to-teal-600',
        gradientBg: 'from-emerald-50 to-teal-100/70',
        badgeClass: 'bg-emerald-50/95 text-emerald-800 border border-emerald-200',
      };
    case 'invoice':
      return {
        label: 'فاتورة',
        icon: <FileSpreadsheet className="w-8 h-8 text-sky-700" />,
        smallIcon: <FileSpreadsheet className="w-3 h-3" />,
        gradient: 'from-sky-500 to-blue-600',
        gradientBg: 'from-sky-50 to-blue-100/70',
        badgeClass: 'bg-sky-50/95 text-sky-800 border border-sky-200',
      };
    case 'statement':
      return {
        label: 'كشف حساب',
        icon: <ClipboardList className="w-8 h-8 text-indigo-700" />,
        smallIcon: <ClipboardList className="w-3 h-3" />,
        gradient: 'from-indigo-500 to-violet-600',
        gradientBg: 'from-indigo-50 to-violet-100/70',
        badgeClass: 'bg-indigo-50/95 text-indigo-800 border border-indigo-200',
      };
    case 'contract':
      return {
        label: 'عقد',
        icon: <FileKey className="w-8 h-8 text-rose-700" />,
        smallIcon: <FileKey className="w-3 h-3" />,
        gradient: 'from-rose-500 to-pink-600',
        gradientBg: 'from-rose-50 to-pink-100/70',
        badgeClass: 'bg-rose-50/95 text-rose-800 border border-rose-200',
      };
    case 'handover':
      return {
        label: 'استلام',
        icon: <FileCheck2 className="w-8 h-8 text-amber-700" />,
        smallIcon: <FileCheck2 className="w-3 h-3" />,
        gradient: 'from-amber-500 to-orange-600',
        gradientBg: 'from-amber-50 to-orange-100/70',
        badgeClass: 'bg-amber-50/95 text-amber-800 border border-amber-200',
      };
    case 'return':
      return {
        label: 'تسليم',
        icon: <LogOut className="w-8 h-8 text-fuchsia-700" />,
        smallIcon: <LogOut className="w-3 h-3" />,
        gradient: 'from-fuchsia-500 to-purple-600',
        gradientBg: 'from-fuchsia-50 to-purple-100/70',
        badgeClass: 'bg-fuchsia-50/95 text-fuchsia-800 border border-fuchsia-200',
      };
    default:
      if (isPdf) {
        return {
          ...fallback,
          label: 'PDF',
          icon: <FileIcon className="w-8 h-8 text-red-600" />,
          smallIcon: <FileIcon className="w-3 h-3" />,
          gradient: 'from-red-500 to-rose-600',
          gradientBg: 'from-red-50 to-rose-100/70',
          badgeClass: 'bg-red-50/95 text-red-800 border border-red-200',
        };
      }
      if (isImage) {
        return {
          ...fallback,
          label: 'صورة',
          icon: <FileImage className="w-8 h-8 text-teal-700" />,
          smallIcon: <FileImage className="w-3 h-3" />,
          gradient: 'from-teal-500 to-cyan-600',
          gradientBg: 'from-teal-50 to-cyan-100/70',
          badgeClass: 'bg-teal-50/95 text-teal-800 border border-teal-200',
        };
      }
      return fallback;
  }
}
