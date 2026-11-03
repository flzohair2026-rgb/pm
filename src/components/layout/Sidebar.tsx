'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  CalendarDays, 
  BedDouble, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  Languages,
  CreditCard,
  PieChart,
  List,
  BookOpen,
  ScrollText,
  UserCog,
  Brush,
  Bell,
  Building2,
    Layers,
    ArrowLeftRight,
    History as HistoryIcon,
    Shield as ActivityShieldIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useAppLanguage } from '@/hooks/useAppLanguage';
import Logo from '@/components/Logo';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  onClick?: () => void;
  disabled?: boolean;
  pathname: string;
}

const SidebarItem = ({ icon: Icon, label, href, onClick, disabled, pathname }: SidebarItemProps) => {
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <Link 
      href={href}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick?.();
      }}
      className={cn(
        "group/item relative mb-1 flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-emerald-700 motion-reduce:transition-none",
        isActive ? "border-emerald-100 bg-emerald-50 text-emerald-950 font-bold" : "text-stone-500 hover:bg-stone-100/70 hover:text-stone-900",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
      aria-disabled={disabled ? true : undefined}
      aria-current={isActive ? 'page' : undefined}
      tabIndex={disabled ? -1 : undefined}
      title={label}
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors', isActive ? 'bg-emerald-900 text-white shadow-sm' : 'text-stone-400 group-hover/item:text-emerald-800')}><Icon size={17} strokeWidth={1.7} /></span>
      <span className="min-w-0 flex-1">{label}</span>
      {isActive && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-emerald-600" />}
    </Link>
  );
};

export function SidebarContent({ onNavigate, hideBrand = false }: { onNavigate?: () => void; hideBrand?: boolean }) {
  const pathname = usePathname();
  const { role, loading, signOut } = useAuthContext();
  const { language, toggleLanguage } = useAppLanguage();
  const router = useRouter();
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isReceptionist = role === 'receptionist';
  const isHousekeeping = role === 'housekeeping';
  const isAccountant = role === 'accountant';
  const isMarketing = role === 'marketing';

  const t = (ar: string, en: string) => (language === 'en' ? en : ar);
  const onToggleLanguage = () => {
    toggleLanguage();
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-6"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!hideBrand && <div className="shrink-0 border-b border-stone-100 px-5 py-6">
        <div className="flex items-center justify-center brightness-[0.55]">
          <Logo className="size-16 object-contain" alt={t('شعار المنشأة', 'Company logo')} />
        </div>
      </div>}

      <nav aria-label={t('التنقل الرئيسي', 'Main navigation')} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-5 [scrollbar-width:thin]">
        <div className="mb-4">
            <p className="mb-3 px-3 text-[10px] font-semibold tracking-wide text-stone-400">{t('العمليات', 'Operations')}</p>
            {isHousekeeping ? (
              <>
                <SidebarItem icon={Brush} label={t('النظافة والصيانة', 'Cleaning & Maintenance')} href="/cleaning" onClick={onNavigate} pathname={pathname} />
              </>
            ) : (
              <>
                {isReceptionist ? (
                  <>
                    <SidebarItem icon={LayoutDashboard} label={t('لوحة التحكم', 'Dashboard')} href="/" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={FileText} label={t('الفواتير', 'Invoices')} href="/invoices" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={CreditCard} label={t('المدفوعات', 'Payments')} href="/payments" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={Users} label={t('العملاء والضيوف', 'Customers')} href="/customers" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={Brush} label={t('النظافة والصيانة', 'Cleaning & Maintenance')} href="/cleaning" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={Bell} label={t('التنبيهات', 'Notifications')} href="/notifications" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={FileText} label={t('أرشيف الوثائق', 'Documents')} href="/documents-archive" onClick={onNavigate} pathname={pathname} />
                  </>
                ) : isAccountant ? (
                  <>
                    <SidebarItem icon={LayoutDashboard} label={t('لوحة التحكم', 'Dashboard')} href="/" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={CalendarDays} label={t('حجز جديد', 'New Booking')} href="/bookings" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={List} label={t('سجل الحجوزات', 'Bookings Log')} href="/bookings-list" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={Users} label={t('العملاء والضيوف', 'Customers')} href="/customers" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={Brush} label={t('النظافة والصيانة', 'Cleaning & Maintenance')} href="/cleaning" onClick={onNavigate} pathname={pathname} />
                  </>
                ) : isMarketing ? (
                  <>
                    <SidebarItem icon={LayoutDashboard} label={t('لوحة التحكم', 'Dashboard')} href="/" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={Users} label={t('العملاء والضيوف', 'Customers')} href="/customers" onClick={onNavigate} pathname={pathname} />
                  </>
                ) : (
                  <>
                    <SidebarItem icon={LayoutDashboard} label={t('لوحة التحكم', 'Dashboard')} href="/" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={CalendarDays} label={t('حجز جديد', 'New Booking')} href="/bookings" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={Layers} label={t('حجز متعدد', 'Group Booking')} href="/group-bookings" onClick={onNavigate} disabled pathname={pathname} />
                    <SidebarItem icon={List} label={t('سجل الحجوزات', 'Bookings Log')} href="/bookings-list" onClick={onNavigate} pathname={pathname} />
                    {(isAdmin || isManager) && <SidebarItem icon={BedDouble} label={t('الوحدات', 'Units')} href="/units" onClick={onNavigate} pathname={pathname} />}
                    <SidebarItem icon={Brush} label={t('النظافة والصيانة', 'Cleaning & Maintenance')} href="/cleaning" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={Bell} label={t('التنبيهات', 'Notifications')} href="/notifications" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={Users} label={t('العملاء والضيوف', 'Customers')} href="/customers" onClick={onNavigate} pathname={pathname} />
                    <SidebarItem icon={FileText} label={t('أرشيف الوثائق', 'Documents')} href="/documents-archive" onClick={onNavigate} pathname={pathname} />
                  </>
                )}
              </>
            )}
        </div>

        {!isReceptionist && !isHousekeeping && (
          <div className="mb-4">
              <p className="mb-3 px-3 text-[10px] font-semibold tracking-wide text-stone-400">{t('المالية والتقارير', 'Finance & Reports')}</p>
              {!isMarketing && (
                <>
                  <SidebarItem icon={FileText} label={t('الفواتير', 'Invoices')} href="/invoices" onClick={onNavigate} pathname={pathname} />
                  <SidebarItem icon={CreditCard} label={t('المدفوعات', 'Payments')} href="/payments" onClick={onNavigate} pathname={pathname} />
                </>
              )}
              <SidebarItem icon={PieChart} label={t('التقارير', 'Reports')} href="/reports" onClick={onNavigate} pathname={pathname} />
          </div>
        )}

        {!isReceptionist && !isHousekeeping && (!isManager || isAccountant) && !isMarketing && (
          <div className="mb-4">
              <p className="mb-3 px-3 text-[10px] font-semibold tracking-wide text-stone-400">{t('المحاسبة', 'Accounting')}</p>
              <SidebarItem icon={BookOpen} label={t('دليل الحسابات', 'Chart of Accounts')} href="/accounting/chart-of-accounts" onClick={onNavigate} pathname={pathname} />
              <SidebarItem icon={ScrollText} label={t('كشف حساب', 'Statement')} href="/accounting/statement" onClick={onNavigate} pathname={pathname} />
              <SidebarItem icon={CalendarDays} label={t('الفترات المحاسبية', 'Periods')} href="/accounting/periods" onClick={onNavigate} pathname={pathname} />
              <SidebarItem icon={Building2} label={t('تسوية المنصات', 'Platforms')} href="/accounting/platforms" onClick={onNavigate} pathname={pathname} />
              <SidebarItem icon={ArrowLeftRight} label={t('قيود يدوية', 'Manual Entries')} href="/accounting/manual-entry" onClick={onNavigate} pathname={pathname} />
          </div>
        )}

        <div>
            <p className="mb-3 px-3 text-[10px] font-semibold tracking-wide text-stone-400">{t('النظام', 'System')}</p>
            {isAdmin && (
              <>
                <SidebarItem icon={UserCog} label={t('المستخدمين والصلاحيات', 'Users & Roles')} href="/admin/users" onClick={onNavigate} pathname={pathname} />
                <SidebarItem icon={HistoryIcon} label={t('سجل مراقبة النظام', 'Audit Log')} href="/admin/audit-log" onClick={onNavigate} pathname={pathname} />
                <SidebarItem icon={ActivityShieldIcon} label={t('سجل نشاط النظام', 'Activity Log')} href="/admin/audit" onClick={onNavigate} pathname={pathname} />
              </>
            )}
            
            {(isAdmin || isManager) && (
              <SidebarItem icon={Settings} label={t('الإعدادات', 'Settings')} href="/settings" onClick={onNavigate} pathname={pathname} />
            )}
        </div>
      </nav>

      <div className="shrink-0 space-y-1 border-t border-stone-100 bg-stone-50/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          onClick={onToggleLanguage}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-stone-600 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-emerald-700"
        >
          <Languages size={17} />
          <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
        <button
          onClick={async () => { try { await signOut(); router.refresh(); } catch {} }}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
        >
          <LogOut size={17} />
          <span>{t('تسجيل الخروج', 'Sign out')}</span>
        </button>
      </div>
    </>
  );
}

export default function Sidebar() {
  return (
    <aside className="fixed right-0 top-0 z-50 hidden h-dvh w-64 flex-col overflow-hidden border-l border-stone-200/80 bg-white 2xl:flex">
      <SidebarContent />
    </aside>
  );
}

