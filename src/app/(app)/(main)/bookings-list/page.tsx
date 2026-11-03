import { createClient } from '@/lib/supabase-server';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Calendar, Layers } from 'lucide-react';
import RoleGate from '@/components/auth/RoleGate';
import BookingsListTable from '@/components/bookings/BookingsListTable';
import { normalizeRegisterFilters, parseRegisterPage, registerUrl, type RegisterPage } from '@/lib/bookings/register';

export const runtime = 'edge';
export const metadata = { title: 'سجل الحجوزات' };

export default async function BookingsListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const params = await searchParams;
  const scalar = (key: string) => typeof params[key] === 'string' ? params[key] as string : undefined;
  const filters = normalizeRegisterFilters({ status: scalar('status'), type: scalar('type'), q: scalar('q'), arrival: scalar('arrival'), departure: scalar('departure'), contract: scalar('contract') });
  const cookieHotel = (await cookies()).get('active_hotel_id')?.value || null;
  let selectedHotelId = cookieHotel || 'all';
  let initialPage: RegisterPage | null = null;
  let initialError: string | null = null;
  // Supabase authenticates the cookie-backed RPC. The invoker function checks
  // the caller's role, resolves their default hotel, and preserves table RLS.
  try {
      const { data, error } = await supabase.rpc('get_bookings_register_page', {
        p_filters: { ...filters, hotel: selectedHotelId }, p_page_size: 5, p_include_count: true,
      }).abortSignal(AbortSignal.timeout(15000));
      if (error) throw error;
      initialPage = parseRegisterPage(data);
      selectedHotelId = initialPage.hotelId || selectedHotelId;
    } catch {
      initialError = 'تعذر تحميل سجل الحجوزات. تحقق من الاتصال ثم أعد المحاولة.';
  }
  return <RoleGate allow={['admin','manager','receptionist','accountant']}>
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="text-lg font-bold text-stone-900 sm:text-2xl">سجل الحجوزات</h1><p className="mt-1 text-xs text-stone-500 sm:text-sm">عرض وإدارة جميع الحجوزات المسجلة في النظام</p></div>
          <div className="flex gap-2">
            <Link href="/bookings" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 text-xs font-semibold text-white hover:bg-emerald-800"><Calendar size={15} />حجز جديد</Link>
            <div aria-disabled title="غير متاح حالياً" className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-xl border border-stone-200 px-3 text-xs text-stone-400"><Layers size={15} />حجز متعدد</div>
          </div>
        </div>
      </div>
      <BookingsListTable key={`${selectedHotelId}:${registerUrl(filters)}`} selectedHotelId={selectedHotelId} pageSize={5} initialFilters={filters} initialPage={initialPage} initialError={initialError} />
    </div>
  </RoleGate>;
}
