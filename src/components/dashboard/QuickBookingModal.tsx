'use client';

import React from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { X, Zap, Phone, User, CalendarDays, FileText, CreditCard, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

function toYMD(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export interface QuickBookingModalProps {
  open: boolean;
  onClose: () => void;
  unitId?: string;
  unitNumber?: string;
  unitTypeName?: string;
  dailyPrice?: number;
  taxRate?: number;
  onSuccess?: (bookingId: string) => void;
}

interface QuickPayload {
  customer_name: string;
  customer_phone?: string;
  national_id?: string;
  email?: string;
  check_in: string;
  check_out: string;
  daily_rate: number;
  notes?: string;
  deposit_amount: number;
  deposit_paid: boolean;
}

export default function QuickBookingModal({
  open,
  onClose,
  unitId,
  unitNumber,
  unitTypeName,
  dailyPrice,
  taxRate,
  onSuccess,
}: QuickBookingModalProps) {
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toYMD(d);
  }, []);

  const tomorrow = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return toYMD(d);
  }, []);

  const [form, setForm] = React.useState<QuickPayload>({
    customer_name: '',
    customer_phone: '',
    national_id: '',
    email: '',
    check_in: today,
    check_out: tomorrow,
    daily_rate: dailyPrice ?? 0,
    notes: '',
    deposit_amount: 0,
    deposit_paid: false,
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successId, setSuccessId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setError(null);
      setSuccessId(null);
      setSubmitting(false);
      setForm({
        customer_name: '',
        customer_phone: '',
        national_id: '',
        email: '',
        check_in: today,
        check_out: tomorrow,
        daily_rate: dailyPrice ?? 0,
        notes: '',
        deposit_amount: 0,
        deposit_paid: false,
      });
    } else {
      setForm((f) => ({ ...f, daily_rate: dailyPrice ?? f.daily_rate }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dailyPrice]);

  const nights = React.useMemo(() => {
    try {
      if (!form.check_in || !form.check_out) return 0;
      return Math.max(
        0,
        differenceInCalendarDays(new Date(`${form.check_out}T00:00:00`), new Date(`${form.check_in}T00:00:00`)),
      );
    } catch {
      return 0;
    }
  }, [form.check_in, form.check_out]);

  const subtotal = form.daily_rate * nights;
  const tax = Math.round(subtotal * (taxRate ?? 0.15) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const update = <K extends keyof QuickPayload>(key: K, value: QuickPayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async () => {
    setError(null);
    setSuccessId(null);

    if (!form.customer_name.trim()) {
      setError('الرجاء إدخال اسم العميل على الأقل');
      return;
    }
    if (!unitId) {
      setError('الوحدة غير محددة');
      return;
    }
    if (!form.check_in || !form.check_out || nights <= 0) {
      setError('تواريخ الحجز غير صالحة');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/bookings/preliminary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone?.trim() || undefined,
          national_id: form.national_id?.trim() || undefined,
          email: form.email?.trim() || undefined,
          check_in: form.check_in,
          check_out: form.check_out,
          daily_rate: Number(form.daily_rate) || undefined,
          deposit_amount: Number(form.deposit_amount) || 0,
          deposit_paid: Boolean(form.deposit_paid),
          notes: form.notes?.trim() || undefined,
          booking_source: 'quick',
          booking_type: 'quick',
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!data?.ok) {
        const codeRaw = String(data?.error_code || '').trim();
        let msg = data?.error || 'فشل إنشاء الحجز الأولي';
        if (codeRaw === 'unit_not_found') {
          msg = `⚠️ الوحدة غير متاحة: ${msg}`;
        } else if (codeRaw === 'date_conflict') {
          msg = `⚡ تعارض في التواريخ: ${msg}\n(هذه التواريخ محجوزة مسبقاً للوحدة - اختر تواريخ أخرى)`;
        } else if (codeRaw === 'invalid_input') {
          msg = `❌ بيانات ناقصة: ${msg}`;
        } else if (codeRaw === 'invalid_dates') {
          msg = `📅 تواريخ خاطئة: ${msg}\n(تأكد أن تاريخ المغادرة بعد تاريخ الوصول بيوم واحد على الأقل)`;
        } else if (codeRaw === 'duplicate_external_ref') {
          msg = `♻️ هذا الطلب سبق معالجته مسبقاً: ${msg}`;
        } else if (codeRaw === 'customer_create_failed') {
          msg = `👤 تعذر إنشاء ملف العميل: ${msg}\n(قد يكون سببه بيانات مكررة أو إعدادات القاعدة)`;
        } else if (codeRaw === 'booking_create_failed') {
          msg = `🧱 تعذر حفظ الحجز في قاعدة البيانات:\n${msg}\n\nملاحظة مهمة: إذا كان الخطأ يحتوي على "bookings_status_check" فهذا يعني أن سكريبت SQL رقم 006 لم يتم تشغيله بعد في Supabase.`;
        }
        console.error('[QuickBookingModal] API returned error:', { status: res.status, code: codeRaw, msg, full: data });
        setError(msg);
        setSubmitting(false);
        return;
      }
      console.info('[QuickBookingModal] success:', data);
      setSuccessId(data.booking_id || null);
      setSubmitting(false);
      if (typeof onSuccess === 'function') {
        setTimeout(() => onSuccess(data.booking_id), 900);
      }
    } catch (e: any) {
      const txt = `تعذر التواصل مع الخادم: ${e?.message || 'خطأ في الشبكة'}`;
      console.error('[QuickBookingModal] network/fetch error:', e);
      setError(txt);
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75]" dir="rtl">
      <div className="absolute inset-0 bg-black/45" onClick={submitting ? undefined : onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div className="relative w-full max-w-xl max-h-[calc(100vh-24px)] overflow-hidden rounded-3xl bg-white shadow-2xl border border-gray-200 flex flex-col">
          <div className="sticky top-0 z-10 border-b bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-2.5">
              <div className="shrink-0 p-2 rounded-2xl bg-emerald-600 text-white shadow-sm">
                <Zap size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-gray-900 text-sm sm:text-base truncate">حجز أولي سريع</div>
                <div className="text-[11px] sm:text-xs text-gray-600 truncate">
                  الوحدة{' '}
                  <span className="font-black text-emerald-700">
                    {unitNumber || '—'}
                  </span>
                  {unitTypeName ? ` · ${unitTypeName}` : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="shrink-0 p-2 rounded-2xl hover:bg-gray-100 text-gray-600 disabled:opacity-50"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-gray-50/60">
            {successId ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                  <CheckCircle2 size={26} />
                </div>
                <div className="font-black text-emerald-900 text-lg">تم الحجز الأولي بنجاح ✅</div>
                <div className="text-[12px] sm:text-xs text-emerald-800/90">
                  يمكنك الآن إكمال الإجراءات الكاملة للأسعار والدفعات من صفحة الحجوزات.
                </div>
                <div className="pt-2 text-[11px] text-emerald-700/80 font-mono truncate">
                  {successId}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] sm:text-xs font-black text-gray-700 mb-1 flex items-center gap-1">
                      <User size={13} /> اسم العميل <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.customer_name}
                      onChange={(e) => update('customer_name', e.target.value)}
                      placeholder="مثال: محمد عبدالله"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] sm:text-xs font-black text-gray-700 mb-1 flex items-center gap-1">
                      <Phone size={13} /> رقم الجوال
                    </label>
                    <input
                      type="tel"
                      value={form.customer_phone}
                      onChange={(e) => update('customer_phone', e.target.value)}
                      placeholder="05xxxxxxxx"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] sm:text-xs font-black text-gray-700 mb-1 flex items-center gap-1">
                      <CalendarDays size={13} /> تاريخ الدخول
                    </label>
                    <input
                      type="date"
                      value={form.check_in}
                      min={today}
                      onChange={(e) => update('check_in', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] sm:text-xs font-black text-gray-700 mb-1 flex items-center gap-1">
                      <CalendarDays size={13} /> تاريخ الخروج
                    </label>
                    <input
                      type="date"
                      value={form.check_out}
                      min={form.check_in || today}
                      onChange={(e) => update('check_out', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] sm:text-xs font-black text-gray-700 mb-1">
                      سعر اليوم (ر.س)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.daily_rate}
                      onChange={(e) => update('daily_rate', Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] sm:text-xs font-black text-gray-700 mb-1 flex items-center gap-1">
                      <CreditCard size={13} /> العربون (ر.س)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.deposit_amount}
                      onChange={(e) => update('deposit_amount', Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 px-3 py-2 w-full rounded-xl border border-gray-200 bg-white cursor-pointer select-none hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.deposit_paid}
                        onChange={(e) => update('deposit_paid', e.target.checked)}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span className="text-[11px] sm:text-xs font-black text-gray-700">تم استلام العربون</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] sm:text-xs font-black text-gray-700 mb-1">
                      رقم الهوية/الإقامة
                    </label>
                    <input
                      type="text"
                      value={form.national_id}
                      onChange={(e) => update('national_id', e.target.value)}
                      placeholder="اختياري"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] sm:text-xs font-black text-gray-700 mb-1">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="اختياري"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] sm:text-xs font-black text-gray-700 mb-1 flex items-center gap-1">
                    <FileText size={13} /> ملاحظات
                  </label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => update('notes', e.target.value)}
                    placeholder="أي تفاصيل إضافية للحجز..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 resize-none"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] sm:text-xs">
                  <div>
                    <div className="text-gray-500 font-bold mb-0.5">الليالي</div>
                    <div className="font-black text-gray-900">{nights}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 font-bold mb-0.5">الإجمالي الفرعي</div>
                    <div className="font-black text-gray-900 font-mono">
                      {subtotal.toLocaleString('ar-SA')}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 font-bold mb-0.5">الضريبة</div>
                    <div className="font-black text-gray-900 font-mono">{tax.toLocaleString('ar-SA')}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 font-bold mb-0.5">الإجمالي</div>
                    <div className="font-black text-emerald-700 font-mono">
                      {total.toLocaleString('ar-SA')}
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                    <div className="font-bold">{error}</div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="sticky bottom-0 z-10 border-t bg-white px-4 py-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-gray-700 text-[12px] sm:text-xs font-black hover:bg-gray-50 disabled:opacity-50"
            >
              إلغاء
            </button>
            {!successId ? (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-[12px] sm:text-xs font-black hover:bg-emerald-700 shadow-sm disabled:opacity-60 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    جار الحفظ...
                  </>
                ) : (
                  <>
                    <Zap size={15} />
                    حفظ كحجز أولي
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-[12px] sm:text-xs font-black hover:bg-emerald-700 shadow-sm flex items-center gap-2"
              >
                إغلاق
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
