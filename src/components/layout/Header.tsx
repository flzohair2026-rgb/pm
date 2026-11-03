'use client';

import Link from 'next/link';
import { ChevronLeft, Menu, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import NotificationsMenu from './NotificationsMenu';
import UserMenu from './UserMenu';
import HotelSwitcher from './HotelSwitcher';
import Logo from '@/components/Logo';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useAppLanguage } from '@/hooks/useAppLanguage';

interface HeaderProps {
  onMenuClick?: () => void;
}

const pageLabels: Record<string, [string, string]> = {
  bookings: ['حجز جديد', 'New booking'],
  'bookings-list': ['سجل الحجوزات', 'Bookings'],
  customers: ['العملاء والضيوف', 'Customers & guests'],
  units: ['إدارة الوحدات', 'Units'],
  invoices: ['الفواتير', 'Invoices'],
  payments: ['المدفوعات', 'Payments'],
  reports: ['التقارير', 'Reports'],
  accounting: ['المحاسبة', 'Accounting'],
  settings: ['الإعدادات', 'Settings'],
  notifications: ['التنبيهات', 'Notifications'],
  cleaning: ['خدمة الغرف', 'Housekeeping'],
  admin: ['إدارة النظام', 'Administration'],
  'documents-archive': ['أرشيف المستندات', 'Document archive'],
};

export default function Header({ onMenuClick }: HeaderProps) {
  const { role, loading, isHousekeeping, isAdmin, hotels, activeHotelId, setActiveHotelId } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useAppLanguage();
  const english = language === 'en';
  const t = (ar: string, en: string) => english ? en : ar;
  const page = pageLabels[pathname.split('/')[1]];
  const title = page ? page[english ? 1 : 0] : t('لوحة التحكم', 'Dashboard');
  const hotelValue = activeHotelId || (isAdmin ? 'all' : '');

  const handleHotelChange = (value: string) => {
    if (!role || (!isAdmin && !value)) return;
    setActiveHotelId(value);
    router.refresh();
  };

  return (
    <header dir={english ? 'ltr' : 'rtl'} className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/95 supports-[backdrop-filter]:bg-white/85 supports-[backdrop-filter]:backdrop-blur-xl">
      <div className="mx-auto flex min-h-20 w-full max-w-screen-2xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 md:px-6 xl:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          {onMenuClick && <button type="button" onClick={onMenuClick} aria-label={t('فتح القائمة', 'Open navigation')}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-emerald-700 2xl:hidden"><Menu size={20} /></button>}
          <Link href={isHousekeeping ? '/cleaning' : '/'} aria-label={t('الصفحة الرئيسية', 'Home')}
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50/60 transition-colors hover:bg-emerald-100/70 focus-visible:outline-2 focus-visible:outline-emerald-700">
            <Logo className="size-8 object-contain" alt="" />
          </Link>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-stone-400 sm:text-[11px]">
              <span>{t('إدارة الضيافة', 'Hospitality management')}</span>
              <ChevronLeft aria-hidden="true" size={11} className={english ? 'rotate-180' : ''} />
              <span className="truncate text-emerald-800">{t('مساحة العمل', 'Workspace')}</span>
            </div>
            <p className="truncate text-sm font-bold tracking-tight text-stone-900 sm:text-base">{title}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:order-last">
          {!isHousekeeping && <Link href="/customers" title={t('العملاء والضيوف', 'Customers & guests')} aria-label={t('العملاء والضيوف', 'Customers & guests')}
            className="hidden size-10 items-center justify-center rounded-xl border border-stone-200 text-stone-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700 lg:flex"><Users size={18} /></Link>}
          {!isHousekeeping && <NotificationsMenu />}
          <span aria-hidden="true" className="mx-1 h-7 w-px bg-stone-200 sm:mx-2" />
          <UserMenu />
        </div>

        {role && <div className="order-last w-full md:order-none md:w-auto md:shrink-0">
          <HotelSwitcher hotels={hotels} value={hotelValue} isAdmin={isAdmin} loading={loading} english={english} onChange={handleHotelChange} />
        </div>}
      </div>
    </header>
  );
}
