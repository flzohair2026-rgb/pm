import { CalendarDays, Home, User } from 'lucide-react';

// Presentation only: amounts are supplied by BookingDetails' existing calculations.
export default function BookingOverviewStrip({ guest, unit, checkIn, checkOut, status, total, paid, remaining }: {
  guest?: string; unit?: string; checkIn: string; checkOut: string; status: string;
  total: number; paid: number; remaining: number;
}) {
  const states: Record<string, string> = { preliminary: 'حجز أولي', pending: 'قيد الانتظار', pending_deposit: 'بانتظار العربون', deposit_paid: 'تم دفع العربون', confirmed: 'مؤكد', checked_in: 'مقيم حاليًا', checked_out: 'تم الخروج', cancelled: 'ملغي' };
  const tone = status === 'cancelled' ? 'bg-red-50 text-red-700' : status === 'checked_in' || status === 'confirmed' ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600';
  const money = (value: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return <section aria-label="نظرة عامة على الحجز" className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500"><User size={19} strokeWidth={1.6} /></span>
        <div className="min-w-0"><p className="text-[10px] text-stone-400">الضيف</p><p className="mt-1 break-words text-sm font-semibold text-stone-900">{guest || 'غير محدد'}</p></div>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${tone}`}>{states[status] || status}</span>
      <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-500 sm:w-auto">
        <span className="inline-flex items-center gap-2"><Home size={14} /><bdi className="font-semibold text-stone-800">{unit || '—'}</bdi></span>
        <span className="inline-flex items-center gap-2"><CalendarDays size={14} /><bdi dir="ltr">{checkIn} — {checkOut}</bdi></span>
      </div>
    </div>
    <dl className="grid grid-cols-1 divide-y divide-stone-100 min-[400px]:grid-cols-3 min-[400px]:divide-y-0">
      {[{ label: 'إجمالي الحجز', value: total }, { label: 'المدفوع', value: paid }, { label: 'المتبقي', value: remaining }].map(({ label, value }, index) => <div key={label} className={`min-w-0 px-4 py-4 sm:px-5 ${index === 2 ? 'bg-emerald-50/60' : ''}`}>
        <dt className="mb-2 text-[11px] text-stone-500">{label}</dt><dd className="flex flex-wrap items-baseline gap-1.5"><bdi dir="ltr" className={`break-all text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${index === 2 ? 'text-emerald-950' : 'text-stone-900'}`}>{money(value)}</bdi><span className="text-[10px] text-stone-400">ر.س</span></dd>
      </div>)}
    </dl>
  </section>;
}
