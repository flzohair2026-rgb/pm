import React from 'react';
import { BookingWizard } from '@/components/bookings/BookingWizard';
import { createClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import RoleGate from '@/components/auth/RoleGate';

export const runtime = 'edge';

export default async function BookingsPage({ searchParams }: { searchParams?: Promise<{ q?: string; unit_id?: string; check_in?: string; check_out?: string; search?: string; embed?: string; scale?: string; complete_booking?: string }> }) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const language = cookieStore.get('app_language')?.value === 'en' ? 'en' : 'ar';
  const t = (arText: string, enText: string) => (language === 'en' ? enText : arText);
  const params = searchParams ? await searchParams : {};
  const q = params?.q || '';
  const unitId = params?.unit_id || '';
  const checkIn = params?.check_in || '';
  const checkOut = params?.check_out || '';
  const searchMode = params?.search || '';
  const isEmbed = params?.embed === '1';
  const completeBookingId = params?.complete_booking?.trim() || '';
  let initialCustomer = null as any;
  let initialQuery = '';
  let completeBookingData: any = null;

  if (completeBookingId) {
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        unit:units(*, unit_type:unit_types(*))
      `)
      .eq('id', completeBookingId)
      .maybeSingle();
    if (existingBooking) {
      completeBookingData = existingBooking;
      initialCustomer = existingBooking.customer;
    }
  }

  if (isEmbed) {
    return (
      <div className="space-y-2">
        <BookingWizard
          initialUnitId={(unitId && unitId.trim()) ? unitId.trim() : undefined}
          initialCheckIn={(checkIn && checkIn.trim()) ? checkIn.trim() : undefined}
          initialCheckOut={(checkOut && checkOut.trim()) ? checkOut.trim() : undefined}
          language={language}
        />
      </div>
    );
  }
  if (q && q.trim() && !completeBookingData) {
    if (searchMode === '1') {
      initialQuery = q.trim();
    } else {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .ilike('full_name', `%${q}%`)
        .limit(1)
        .maybeSingle();
      if (data) initialCustomer = data;
    }
  }
  return (
    <RoleGate allow={['admin', 'manager', 'receptionist', 'accountant']}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
          <span>{t('الحجوزات', 'Bookings')}</span>
          <span>/</span>
          <span className="font-medium text-gray-900">
            {completeBookingData ? t('إكمال إجراءات الحجز', 'Complete Booking') : t('حجز جديد', 'New booking')}
          </span>
        </div>
        {completeBookingData && (
          <div className="bg-gradient-to-l from-amber-50 via-amber-50/50 to-white border border-amber-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-amber-900 text-sm">
                  {t('وضع إكمال الحجز', 'Booking Completion Mode')}
                </h3>
                <p className="text-xs text-amber-800 mt-1">
                  {t(`رقم الحجز: ${completeBookingData.id?.slice(0, 12)}... — يتم تحديث نفس السجل وإنشاء الفواتير المفقودة فقط.`, `Booking ID: ${completeBookingData.id?.slice(0, 12)}... — same record will be updated, only missing invoices created.`)}
                </p>
              </div>
            </div>
          </div>
        )}
        <BookingWizard 
          mode={completeBookingData ? 'complete' : 'create'}
          completeBookingId={completeBookingData ? completeBookingId : undefined}
          completeBookingData={completeBookingData || undefined}
          initialCustomer={initialCustomer || undefined} 
          initialUnitId={(completeBookingData?.unit?.id) || ((unitId && unitId.trim()) ? unitId.trim() : undefined)}
          initialQuery={initialQuery || undefined}
          initialCheckIn={(completeBookingData?.check_in) || ((checkIn && checkIn.trim()) ? checkIn.trim() : undefined)}
          initialCheckOut={(completeBookingData?.check_out) || ((checkOut && checkOut.trim()) ? checkOut.trim() : undefined)}
          language={language}
        />
      </div>
    </RoleGate>
  );
}
