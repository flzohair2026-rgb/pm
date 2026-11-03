import Link from 'next/link';
import { ArrowUpLeft, BedDouble, Bell, CalendarCheck, ChevronDown, CreditCard, Download, FileText, Plus, Search, TrendingUp, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import GlobalCustomerSearch from './GlobalCustomerSearch';
import { RevenueChart } from './RevenueChart';

interface DashboardOverviewProps {
  language: 'ar' | 'en';
  today: string;
  isReceptionist: boolean;
  isMarketing: boolean;
  revenue: string;
  occupancyRate: number;
  activeBookings: number;
  arrivals: number;
  notifications: { id: string; message: string; created_at: string }[];
  chartData: { date: string; amount: number }[];
  dailyTip: string;
}

export default function DashboardOverview(props: DashboardOverviewProps) {
  const { language, today, isReceptionist, isMarketing } = props;
  const t = (arabic: string, english: string) => language === 'en' ? english : arabic;
  const showFinance = !isReceptionist && !isMarketing;
  const date = new Date(`${today}T12:00:00+03:00`).toLocaleDateString(language === 'en' ? 'en-GB' : 'ar-SA', {
    timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', calendar: 'gregory',
  });
  const stats = [
    { label: t('نسبة الإشغال', 'Occupancy'), value: `${props.occupancyRate}%`, icon: BedDouble, note: t('من إجمالي الوحدات', 'Of all units') },
    { label: t('النزلاء حالياً', 'Guests now'), value: String(props.activeBookings), icon: Users, note: t('حجوزات نشطة', 'Active bookings') },
    { label: t('وصول اليوم', 'Arrivals today'), value: String(props.arrivals), icon: CalendarCheck, note: t('حجوزات متوقع وصولها', 'Expected arrivals') },
    ...(showFinance ? [{ label: t('إيرادات الشهر', 'Monthly revenue'), value: props.revenue, icon: TrendingUp, note: t('المحصّل في الصندوق والبنك', 'Collected in cash and bank') }] : []),
  ];
  const shortcuts = [
    ...(!isMarketing ? [{ href: '/bookings-list', label: t('سجل الحجوزات', 'Bookings log'), icon: CalendarCheck }] : []),
    { href: '/customers', label: t('العملاء والضيوف', 'Customers & guests'), icon: Users },
    ...(showFinance ? [
      { href: '/invoices', label: t('الفواتير', 'Invoices'), icon: FileText },
      { href: '/payments', label: t('المدفوعات', 'Payments'), icon: CreditCard },
    ] : []),
    ...(!isMarketing && !isReceptionist ? [{ href: '/units', label: t('إدارة الوحدات', 'Manage units'), icon: BedDouble }] : []),
  ];
  return (
    <section aria-label={t('ملخص لوحة التحكم', 'Dashboard overview')} className="space-y-4 rounded-3xl border border-stone-200/80 bg-[#faf9f6] p-4 sm:p-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">{t('لوحة التحكم', 'Dashboard')}</h1>
          <p className="text-[11px] text-stone-500 sm:text-xs">{date}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/reports/daily?date=${today}&autoprint=1`} target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            <Download size={16} />{t('تقرير اليوم', 'Today’s report')}
          </Link>
          {!isMarketing && <Link href="/bookings"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-xs font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            <Plus size={17} />{t('حجز جديد', 'New booking')}
          </Link>}
        </div>
      </header>

      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <div className={`min-w-0 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm sm:h-[25rem] lg:col-span-2 ${showFinance ? 'h-[17.5rem]' : 'h-[34rem] min-[480px]:h-[28rem]'}`}>
          {showFinance
            ? <RevenueChart data={props.chartData} language={language} fillContainer />
            : <GlobalCustomerSearch language={language} compact />}
        </div>
        <aside className="flex h-[17.5rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-3 shadow-sm sm:h-[25rem] sm:p-5">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-stone-100 pb-2 sm:mb-4 sm:pb-4">
            <h2 className="flex items-center gap-2 text-xs font-bold text-stone-800"><Bell size={15} className="text-emerald-800" />{t('آخر تنبيهات الحجوزات', 'Latest booking alerts')}</h2>
            <Link href="/notifications" className="rounded px-1 py-1 text-[11px] font-semibold text-emerald-800 hover:underline">{t('عرض الكل', 'View all')}</Link>
          </div>
          <div tabIndex={0} aria-label={t('آخر أربعة تنبيهات للحجوزات', 'Latest four booking alerts')} className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-emerald-700">
            {props.notifications.slice(0, 4).map((item, index) => (
              <div key={item.id} style={{ animationDelay: `${index * 70}ms` }} className="booking-alert-entry flex items-start gap-2 rounded-lg py-2 transition-colors hover:bg-stone-50 motion-reduce:transition-none first:pt-1 last:pb-1 sm:gap-3 sm:py-3">
                <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 sm:size-8"><CalendarCheck size={15} /></span>
                <div className="min-w-0"><p className="break-words text-xs leading-6 text-stone-700">{item.message}</p>
                <p className="mt-1.5 text-[10px] text-stone-400">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: language === 'en' ? enUS : ar })}</p></div>
              </div>
            ))}
            {props.notifications.length === 0 && <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><Bell size={28} strokeWidth={1.4} className="text-stone-300" /><p className="text-xs text-stone-500">{t('لا توجد تنبيهات للحجوزات حالياً', 'No booking alerts right now')}</p></div>}
          </div>
        </aside>
      </div>
      <nav aria-label={t('اختصارات العمل', 'Workspace shortcuts')} className="flex flex-wrap items-center gap-2">
        {shortcuts.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-[11px] font-semibold text-stone-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-700">
            <Icon size={14} />{label}
          </Link>
        ))}
      </nav>

      <dl aria-label={t('مؤشرات اليوم', 'Daily indicators')} className={`grid overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-200/80 gap-px ${showFinance ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 min-[400px]:grid-cols-3'}`}>
        {stats.map(({ label, value, icon: Icon, note }) => (
          <div key={label} className="flex min-w-0 items-center gap-3 bg-white px-4 py-3.5" title={note}>
            <Icon aria-hidden="true" size={18} strokeWidth={1.6} className="hidden shrink-0 text-emerald-800 sm:block" />
            <div className="min-w-0 space-y-1">
              <dt className="text-[11px] font-medium text-stone-500">{label}</dt>
              <dd className="break-words text-lg font-bold leading-tight tracking-tight text-stone-900 tabular-nums sm:text-xl">{value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {showFinance && <details open className="group rounded-2xl border border-stone-200/80 bg-white">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[11px] font-semibold text-stone-600 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><Search size={16} className="text-emerald-800" />{t('البحث السريع وملخص اليوم', 'Quick search & daily insights')}</span>
          <span className="flex items-center gap-2 text-stone-400">{t('التفاصيل', 'Details')}<ChevronDown size={15} className="transition-transform group-open:rotate-180" /></span>
        </summary>
        <div className="grid gap-4 border-t border-stone-100 p-4 lg:grid-cols-3">
          <div className="h-[34rem] min-w-0 overflow-hidden rounded-2xl border border-stone-200 min-[480px]:h-[28rem] sm:h-[25rem] lg:col-span-2"><GlobalCustomerSearch language={language} compact /></div>
          <div className="flex flex-col justify-between gap-6 rounded-xl bg-stone-50 p-5">
            <div><h2 className="mb-3 text-sm font-bold text-stone-800">{t('قراءة اليوم', 'Today’s insight')}</h2><p className="text-xs leading-7 text-stone-600">{props.dailyTip}</p></div>
            <Link href="/reports" className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 hover:underline">{t('التقارير التفصيلية', 'Detailed reports')}<ArrowUpLeft size={15} className={language === 'en' ? 'rotate-90' : ''} /></Link>
          </div>
        </div>
      </details>}
    </section>
  );
}
