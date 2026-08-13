'use client';

import {
  AlertCircle,
  CreditCard,
  CalendarClock,
  LogOut,
  BedDouble,
  Sparkles,
  TrendingUp
} from 'lucide-react';

export interface WelcomeChip {
  id: string;
  unit_number: string;
  days?: number;
}

export interface WelcomeSummaryData {
  language: 'ar' | 'en';
  user_name: string;
  greeting_hour: number;
  late_payments: WelcomeChip[];
  expiring_bookings: WelcomeChip[];
  overdue_checkouts: WelcomeChip[];
  today_checkouts: WelcomeChip[];
  today_arrivals: WelcomeChip[];
}

const tAr = {
  goodMorning: 'صباح النور',
  goodAfternoon: 'مساء الخير',
  goodEvening: 'مساء الورد',
  greeting: 'أهلاً بك يا',
  subGreeting: 'إليك ملخص حالة الوحدات اليومية',
  latePayments: 'متأخرون سداد',
  expiring: 'قارب انتهاء الحجز',
  overdueOut: 'متجاوزون الخروج',
  todayOut: 'مغادرات اليوم',
  todayIn: 'وصولات اليوم',
  allClean: 'ممتاز',
  urgentAlerts: 'تنبيه عاجل',
  allGood: 'كل شيء بخير',
  unit: 'وحدة',
  units: 'وحدة'
};

const tEn = {
  goodMorning: 'Good morning',
  goodAfternoon: 'Good afternoon',
  goodEvening: 'Good evening',
  greeting: 'Welcome back,',
  subGreeting: "Today's unit status at a glance",
  latePayments: 'Late payments',
  expiring: 'Expiring soon',
  overdueOut: 'Overdue',
  todayOut: 'Departures',
  todayIn: 'Arrivals',
  allClean: 'All clear',
  urgentAlerts: 'Urgent',
  allGood: 'All good',
  unit: 'unit',
  units: 'units'
};

type Tone = 'rose' | 'amber' | 'sky' | 'emerald' | 'indigo';

function Tile({
  title,
  icon: Icon,
  tone,
  count,
  lang
}: {
  title: string;
  icon: any;
  tone: Tone;
  count: number;
  lang: 'ar' | 'en';
}) {
  const t = lang === 'en' ? tEn : tAr;
  const isOne = count === 1;
  const cardBg: Record<Tone, string> = {
    rose: 'from-rose-50 via-white to-white ring-rose-100',
    amber: 'from-amber-50 via-white to-white ring-amber-100',
    sky: 'from-sky-50 via-white to-white ring-sky-100',
    emerald: 'from-emerald-50 via-white to-white ring-emerald-100',
    indigo: 'from-indigo-50 via-white to-white ring-indigo-100'
  };
  const iconBox: Record<Tone, string> = {
    rose: 'bg-rose-100 text-rose-700 ring-rose-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
    sky: 'bg-sky-100 text-sky-700 ring-sky-200',
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    indigo: 'bg-indigo-100 text-indigo-700 ring-indigo-200'
  };
  const countFill: Record<Tone, string> = {
    rose: 'from-rose-600 to-rose-800',
    amber: 'from-amber-600 to-amber-800',
    sky: 'from-sky-600 to-sky-800',
    emerald: 'from-emerald-600 to-emerald-800',
    indigo: 'from-indigo-600 to-indigo-800'
  };

  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-br ring-1 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5 sm:p-6 ${cardBg[tone]}`}
    >
      <div className="flex items-center gap-4 mb-4">
        <div
          className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center shadow-sm ring-2 ${iconBox[tone]}`}
        >
          <Icon size={22} strokeWidth={2.3} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[9px] sm:text-base font-black text-slate-900 leading-tight break-words">
            {title}
          </h3>
          <p className="text-[8px] sm:text-xs text-slate-800 font-bold mt-0.5">
            {isOne ? t.unit : t.units}
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div
          className={`bg-gradient-to-br ${countFill[tone]} bg-clip-text text-transparent leading-none font-black tracking-tight text-1xl sm:text-3xl`}
          style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.05)' }}
        >
          {count}
        </div>
        {count === 0 ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-10 ring-1 ring-slate-200 px-1.5 py-1 text-[10px] font-black text-slate-500">
            <Sparkles size={9} />
            {t.allClean}
          </div>
        ) : (
          <div
            className={`shrink-0 inline-flex items-center justify-center rounded-xl h-10 px-2 min-w-[12px] shadow-md bg-gradient-to-br ${countFill[tone]} text-white`}
          >
            <span className="text-lg font-black leading-none">{count}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function WelcomeSummary({ data }: { data: WelcomeSummaryData }) {
  const t = data.language === 'en' ? tEn : tAr;
  const hour = data.greeting_hour;
  const greetingBase =
    hour < 12 ? t.goodMorning : hour < 17 ? t.goodAfternoon : t.goodEvening;

  const totalAlerts =
    data.late_payments.length +
    data.expiring_bookings.length +
    data.overdue_checkouts.length;

  return (
    <section className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-5 sm:p-7 lg:p-8 text-white shadow-2xl ring-1 ring-white/10 overflow-hidden isolate">
      <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-400/25 blur-3xl -z-10" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl -z-10" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 mb-7">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-3.5 py-1.5 text-xs sm:text-sm font-extrabold backdrop-blur-sm">
              <Sparkles size={12} className="text-amber-300 shrink-0" />
              <span className="truncate">{greetingBase}</span>
            </span>
            {totalAlerts > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 ring-1 ring-rose-300/25 px-3.5 py-1.5 text-xs sm:text-sm font-extrabold text-rose-100 backdrop-blur-sm">
                <AlertCircle size={13} className="shrink-0" />
                {totalAlerts} {t.urgentAlerts}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 ring-1 ring-emerald-300/25 px-3.5 py-1.5 text-xs sm:text-sm font-extrabold text-emerald-100 backdrop-blur-sm">
                <TrendingUp size={13} className="shrink-0" />
                {t.allGood}
              </span>
            )}
          </div>
          <h1 className="text-1xl sm:text-3xl lg:text-4xl font-black tracking-tight truncate leading-tight mb-2">
            {t.greeting} <span className="text-amber-200">{data.user_name || '—'}</span>
          </h1>
          <p className="text-sm sm:text-base text-white/75 font-semibold max-w-2xl leading-relaxed">
            {t.subGreeting}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
        <Tile
          title={t.latePayments}
          icon={CreditCard}
          tone="rose"
          count={data.late_payments.length}
          lang={data.language}
        />
        <Tile
          title={t.expiring}
          icon={CalendarClock}
          tone="amber"
          count={data.expiring_bookings.length}
          lang={data.language}
        />
        <Tile
          title={t.overdueOut}
          icon={LogOut}
          tone="indigo"
          count={data.overdue_checkouts.length}
          lang={data.language}
        />
        <Tile
          title={t.todayOut}
          icon={AlertCircle}
          tone="sky"
          count={data.today_checkouts.length}
          lang={data.language}
        />
        <Tile
          title={t.todayIn}
          icon={BedDouble}
          tone="emerald"
          count={data.today_arrivals.length}
          lang={data.language}
        />
      </div>
    </section>
  );
}
