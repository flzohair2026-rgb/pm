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
  Wrench,
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
  const isActive = pathname === href;

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
        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
        "lg:justify-center xl:justify-start lg:group-hover:justify-start",
        "hover:bg-emerald-50 text-emerald-900",
        isActive && "bg-gradient-to-l from-emerald-700 via-emerald-800 to-emerald-900 text-white font-extrabold shadow-sm",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
      aria-disabled={disabled ? true : undefined}
      title={label}
    >
      <Icon size={20} />
      <span className="hidden xl:inline lg:group-hover:inline">{label}</span>
    </Link>
  );
};

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
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
      <div className="p-6 hidden xl:block">
        <div className="flex flex-col items-center text-center gap-2">
          <Logo className="w-16 h-16 object-contain" alt="Logo" />
          <div className="text-[12px] font-extrabold text-emerald-900">نظام ادارة الفنادق</div>
        </div>
      </div>

      <nav className="flex-1 p-2 xl:p-4 space-y-1 overflow-y-auto">
        <div className="mb-4">
            <p className="px-3 text-xs font-extrabold text-emerald-800 uppercase tracking-wider mb-2 hidden xl:block">{t('العمليات', 'Operations')}</p>
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
              <p className="px-3 text-xs font-extrabold text-emerald-800 uppercase tracking-wider mb-2 hidden xl:block">{t('المالية والتقارير', 'Finance & Reports')}</p>
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
              <p className="px-3 text-xs font-extrabold text-emerald-800 uppercase tracking-wider mb-2 hidden xl:block">{t('المحاسبة', 'Accounting')}</p>
              <SidebarItem icon={BookOpen} label={t('دليل الحسابات', 'Chart of Accounts')} href="/accounting/chart-of-accounts" onClick={onNavigate} pathname={pathname} />
              <SidebarItem icon={ScrollText} label={t('كشف حساب', 'Statement')} href="/accounting/statement" onClick={onNavigate} pathname={pathname} />
              <SidebarItem icon={CalendarDays} label={t('الفترات المحاسبية', 'Periods')} href="/accounting/periods" onClick={onNavigate} pathname={pathname} />
              <SidebarItem icon={Building2} label={t('تسوية المنصات', 'Platforms')} href="/accounting/platforms" onClick={onNavigate} pathname={pathname} />
              <SidebarItem icon={ArrowLeftRight} label={t('قيود يدوية', 'Manual Entries')} href="/accounting/manual-entry" onClick={onNavigate} pathname={pathname} />
          </div>
        )}

        <div>
            <p className="px-3 text-xs font-extrabold text-emerald-800 uppercase tracking-wider mb-2 hidden xl:block">{t('النظام', 'System')}</p>
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

      <div className="p-2 xl:p-4 border-t">
        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-3 px-3 py-2 w-full hover:bg-emerald-50 rounded-md transition-colors lg:justify-center xl:justify-start text-emerald-900"
        >
          <Languages size={20} />
          <span className="hidden xl:inline">{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
        <button
          onClick={async () => { try { await signOut(); router.refresh(); } catch {} }}
          className="flex items-center gap-3 px-3 py-2 w-full text-right text-red-600 hover:bg-red-50 rounded-md transition-colors lg:justify-center xl:justify-start"
        >
          <LogOut size={20} />
          <span className="hidden xl:inline">{t('تسجيل الخروج', 'Sign out')}</span>
        </button>
      </div>
    </>
  );
}

export default function Sidebar() {
  return (
    <aside className="group hidden 2xl:flex 2xl:w-64 transition-[width] duration-300 bg-white h-screen flex-col fixed right-0 top-0 z-50 overflow-y-auto overflow-x-hidden shadow-sm ring-1 ring-emerald-100/70">
      <SidebarContent />
    </aside>
  );
}
