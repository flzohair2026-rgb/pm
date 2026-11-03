'use client';

import { useRouter } from 'next/navigation';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { AlertCircle, ArrowUpLeft, BedDouble, CalendarDays, ChevronDown, Clock, MessageCircle, Phone, Plus, User, X, Zap } from 'lucide-react';
import type { Unit } from './RoomStatusGrid';

export default function UnitDetailsDialog({ unit, language, selectedDate, statusLabel, actionLabel, onClose, onQuickBooking, onNewBooking, onContact }: {
  unit: Unit; language: 'ar' | 'en'; selectedDate?: string; statusLabel: string; actionLabel?: string;
  onClose: () => void; onQuickBooking: () => void; onNewBooking: () => void; onContact: () => void;
}) {
  const router = useRouter();
  const english = language === 'en';
  const t = (ar: string, en: string) => english ? en : ar;
  const date = (value?: string) => {
    if (!value) return '—';
    const parsed = new Date(`${value.split('T')[0]}T12:00:00+03:00`);
    return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(english ? 'en-GB' : 'ar-SA', { calendar: 'gregory', numberingSystem: 'latn', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(parsed);
  };
  const money = (value: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const hasBooking = Boolean(unit.booking_id);
  const hasGuest = Boolean(unit.guest_name || unit.action_guest_name || unit.guest_phone);
  const matchingFinancials = Boolean(unit.booking_id && unit.payment_booking_id === unit.booking_id);
  const hasFinancials = matchingFinancials && typeof unit.payment_invoice_total === 'number' && Number.isFinite(unit.payment_invoice_total);
  const paid = typeof unit.payment_invoice_paid === 'number' && Number.isFinite(unit.payment_invoice_paid) ? unit.payment_invoice_paid : null;
  const total = hasFinancials ? unit.payment_invoice_total! : null;
  const remaining = total !== null && paid !== null ? Math.max(0, total - paid) : null;
  const progress = total !== null && total > 0 && paid !== null ? Math.max(0, Math.min(100, Math.round(paid / total * 100))) : null;
  const monthly = Number(unit.annual_price) / 12;
  const hasPrice = Number.isFinite(monthly) && monthly > 0;
  const isOverdue = unit.next_action === 'overdue';
  const paymentAlert = Boolean(unit.payment_due_status);
  const paymentMatches = matchingFinancials;
  const paymentText = unit.payment_due_status === 'overdue' ? t('دفعة متأخرة', 'Overdue payment') : unit.payment_due_status === 'due_today' ? t('دفعة مستحقة اليوم', 'Payment due today') : t('دفعة قادمة', 'Upcoming payment');
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';
  const secondary = `${button} border border-stone-200 bg-white text-stone-700 hover:bg-stone-50`;
  const primary = `${button} bg-emerald-900 text-white hover:bg-emerald-800`;
  const openBooking = () => { onClose(); router.push(`/bookings-list/${unit.booking_id}`); };

  return <ModalOverlay isOpen onOpenChange={open => { if (!open) onClose(); }} isDismissable
    className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/45 p-3 backdrop-blur-sm motion-safe:data-entering:animate-in motion-safe:data-entering:fade-in motion-safe:data-exiting:animate-out motion-safe:data-exiting:fade-out">
    <Modal className="max-h-[90dvh] w-full max-w-xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl motion-safe:data-entering:animate-in motion-safe:data-entering:zoom-in-95 motion-safe:duration-150">
      <Dialog dir={english ? 'ltr' : 'rtl'} className="flex max-h-[90dvh] flex-col outline-none">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-100 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-900"><BedDouble size={23} strokeWidth={1.6} /></span>
            <div className="min-w-0"><div className="mb-1 text-[10px] font-medium text-stone-400">{hasBooking ? t('ملخص الحجز', 'Booking overview') : t('تفاصيل الوحدة', 'Unit overview')}</div>
              <Heading slot="title" className="break-words text-lg font-bold tracking-tight text-stone-900">{t('الوحدة', 'Unit')} <bdi dir="ltr">{unit.unit_number}</bdi></Heading>
              <p className="mt-1 text-xs text-stone-500">{unit.unit_type_name || t('وحدة سكنية', 'Accommodation unit')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2"><span className={`hidden rounded-full px-2.5 py-1.5 text-[10px] font-semibold min-[400px]:inline-flex ${isOverdue ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>{statusLabel}</span>
            <Button slot="close" aria-label={t('إغلاق تفاصيل الوحدة', 'Close unit details')} className="flex size-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-emerald-700"><X size={18} /></Button>
          </div>
        </div>

        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-[10px] font-semibold text-stone-600 min-[400px]:hidden">{statusLabel}</span>
          {selectedDate && <p className="text-[10px] text-stone-400">{t('البيانات حسب تاريخ اللوحة:', 'Dashboard date:')} {date(selectedDate)}</p>}
          {hasGuest && <div className="flex items-start gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-stone-500 ring-1 ring-stone-200"><User size={19} strokeWidth={1.6} /></span>
            <div className="min-w-0 flex-1"><p className="text-[10px] text-stone-400">{t('الضيف', 'Guest')}</p><p className="mt-1 break-words text-sm font-semibold text-stone-900">{unit.guest_name || unit.action_guest_name || t('اسم غير مسجل', 'No name registered')}</p>
              {unit.guest_phone && <a href={`tel:${unit.guest_phone.replace(/[^\d+]/g, '')}`} className="mt-2 inline-flex items-center gap-2 rounded text-xs text-stone-500 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700"><Phone size={12} /><bdi dir="ltr">{unit.guest_phone}</bdi></a>}
            </div>
          </div>}

          {(unit.booking_check_in || unit.booking_check_out) && <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold text-stone-800">{t('فترة الإقامة', 'Stay dates')}</h3>
              {typeof unit.remaining_days === 'number' && !isOverdue && <span className="inline-flex items-center gap-1.5 text-[11px] text-stone-500"><Clock size={12} /><bdi>{unit.remaining_days}</bdi> {unit.next_action === 'arrival' || unit.status === 'future_booked' || unit.status === 'future_preliminary' ? t('يوم حتى الوصول', 'days until arrival') : t('يوم حتى المغادرة', 'days until departure')}</span>}
            </div>
            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-stone-200 rounded-2xl border border-stone-200 p-4">
              <div className="min-w-0 pe-3"><p className="mb-2 flex items-center gap-1.5 text-[10px] text-stone-400"><CalendarDays size={12} />{t('الوصول', 'Check-in')}</p><p className="text-xs font-semibold leading-6 text-stone-800">{date(unit.booking_check_in)}</p></div>
              <div className="min-w-0 ps-4"><p className="mb-2 text-[10px] text-stone-400">{t('المغادرة', 'Check-out')}</p><p className="text-xs font-semibold leading-6 text-stone-800">{date(unit.booking_check_out)}</p></div>
            </div>
          </div>}

          {hasFinancials && <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4"><div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-semibold text-emerald-950">{t('ملخص الفواتير', 'Invoice summary')}</h3><span className="text-[10px] text-emerald-800/60">{t('ريال سعودي', 'SAR')}</span></div>
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">{[[t('إجمالي الفواتير', 'Invoiced'), total], [t('المدفوع', 'Paid'), paid], [t('المتبقي', 'Remaining'), remaining]].map(([label, amount]) => <div key={String(label)}><p className="mb-1.5 text-[10px] text-stone-500">{label}</p><bdi dir="ltr" className="block text-base font-bold tabular-nums text-emerald-950">{typeof amount === 'number' ? money(amount) : '—'}</bdi></div>)}</div>
            {progress !== null && <div className="mt-4"><div className="mb-2 flex justify-between text-[10px] text-emerald-800"><span>{t('نسبة السداد', 'Paid progress')}</span><bdi>{progress}%</bdi></div><div role="progressbar" aria-label={t('نسبة سداد الفواتير', 'Invoice payment progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${progress}%` }} /></div></div>}
          </div>}

          {hasPrice && <div className="flex flex-wrap justify-between gap-2 border-b border-stone-100 pb-4 text-xs"><span className="text-stone-400">{t('السعر الشهري المرجعي للوحدة', 'Reference monthly unit price')}</span><span className="font-semibold text-stone-700"><bdi dir="ltr">{money(monthly)}</bdi> {t('ر.س', 'SAR')}</span></div>}

          {actionLabel && <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-6 ${isOverdue ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-stone-200 bg-stone-50 text-stone-600'}`}><AlertCircle size={16} className="mt-1 shrink-0" /><span>{actionLabel}</span></div>}
          {paymentAlert && <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900"><AlertCircle size={16} className="mt-1 shrink-0" /><div><p className="font-semibold">{paymentText}{!paymentMatches && <> · {t('لحجز آخر على الوحدة', 'Another booking on this unit')}</>}</p><p>{date(unit.payment_due_date)}{typeof unit.payment_due_amount === 'number' && <> · <bdi dir="ltr">{money(unit.payment_due_amount)}</bdi> {t('ر.س', 'SAR')}</>}</p></div></div>}

          {hasBooking && unit.status !== 'maintenance' && <details className="group border-t border-stone-100 pt-3"><summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-[11px] font-medium text-stone-500 [&::-webkit-details-marker]:hidden">{t('إجراءات إضافية للوحدة', 'More unit actions')}<ChevronDown size={13} className="transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary><div className="mt-2 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2"><button type="button" onClick={onNewBooking} className={secondary}><Plus size={15} />{t('حجز لفترة أخرى', 'Book another stay')}</button><button type="button" onClick={onQuickBooking} className={secondary}><Zap size={15} />{t('حجز أولي سريع', 'Quick preliminary booking')}</button></div></details>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-stone-100 bg-stone-50/50 px-5 py-4 sm:px-6">
          {hasBooking ? <button type="button" onClick={openBooking} className={`${primary} flex-1`}>{t('فتح بيانات الحجز', 'Open booking')}<ArrowUpLeft size={16} /></button> : unit.status !== 'maintenance' ? <><button type="button" onClick={onNewBooking} className={`${primary} flex-1`}><Plus size={15} />{t('حجز جديد', 'New booking')}</button><button type="button" onClick={onQuickBooking} className={secondary}><Zap size={15} />{t('حجز أولي', 'Quick booking')}</button></> : null}
          {hasGuest && <button type="button" onClick={onContact} className={`${secondary} flex-1`}><MessageCircle size={16} />{t('تواصل مع الضيف', 'Contact guest')}</button>}
          {!hasBooking && !hasGuest && unit.status === 'maintenance' && <Button slot="close" className={`${secondary} w-full`}>{t('إغلاق', 'Close')}</Button>}
        </div>
      </Dialog>
    </Modal>
  </ModalOverlay>;
}
