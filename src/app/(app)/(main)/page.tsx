import React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase-server';
import { Unit } from '@/components/dashboard/RoomStatusGrid';
import RoomStatusWithDate from '@/components/dashboard/RoomStatusWithDate';
import { RecentBookingsTable, Booking } from '@/components/dashboard/RecentBookingsTable';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import { measureDashboard } from '@/lib/dashboard-performance';

export const runtime = 'edge';

export default async function Home() {
  const measurement = measureDashboard('server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  measurement.mark('auth');
  let role: 'admin' | 'manager' | 'receptionist' | 'accountant' | 'marketing' | 'housekeeping' | null = 'receptionist';
  let defaultHotelId: string | null = null;
  if (user?.id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('role, default_hotel_id')
      .eq('id', user.id)
      .single();
    role = (prof?.role as any) || 'receptionist';
    defaultHotelId = (prof as any)?.default_hotel_id ? String((prof as any).default_hotel_id) : null;
  }
  measurement.mark('profile');
  if (role === 'housekeeping') {
    redirect('/cleaning');
  }
  const isReceptionist = role === 'receptionist';
  const isMarketing = role === 'marketing';
  const cookieStore = await cookies();
  const language = cookieStore.get('app_language')?.value === 'en' ? 'en' : 'ar';
  const cookieHotel = cookieStore.get('active_hotel_id')?.value || null;
  const selectedHotelId = (() => {
    if (role === 'admin') {
      return cookieHotel || 'all';
    }
    if (cookieHotel && cookieHotel !== 'all') return cookieHotel;
    if (defaultHotelId) return defaultHotelId;
    return 'all';
  })();
  const t = (arText: string, enText: string) => (language === 'en' ? enText : arText);
  const unknownGuestName = t('غير معروف', 'Unknown');
  const currencyFormatter = new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0
  });
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const nextDayStr = (() => {
    const base = new Date(`${todayStr}T00:00:00`);
    base.setDate(base.getDate() + 1);
    return base.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  })();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();
  const last7Start = last7Days[0];
  // todayStr is already a Riyadh calendar date; do not convert local midnight to UTC.
  const startOfMonthStr = `${todayStr.slice(0, 7)}-01`;
  const endOfMonthExclusiveStr = new Date(Date.UTC(
    Number(todayStr.slice(0, 4)), Number(todayStr.slice(5, 7)), 1
  )).toISOString().split('T')[0];

  // ==========================================
  // BATCH 1: المستقل عن الفنادق — يعمل مباشرة
  // ==========================================
  const unitsBase = supabase
    .from('units')
    .select('id, unit_number, status, unit_type_id, unit_type:unit_types(id, name, annual_price, daily_price)')
    .order('unit_number');
  const activeBookingsBase = supabase
    .from('bookings')
    .select('id, unit_id, customers(full_name, phone), status')
    .in('status', ['checked_in', 'confirmed']);
  const arrivalsBase = supabase
    .from('bookings')
    .select('id, unit_id, customers(full_name, phone)')
    .eq('status', 'confirmed')
    .eq('check_in', todayStr);
  const departuresBase = supabase
    .from('bookings')
    .select('id, unit_id, customers(full_name, phone)')
    .in('status', ['checked_in', 'confirmed'])
    .eq('check_out', todayStr)
    .lte('check_in', todayStr);
  const overdueBase = supabase
    .from('bookings')
    .select('id, unit_id, customers(full_name, phone)')
    .eq('status', 'checked_in')
    .lt('check_out', todayStr);
  const recentBase = supabase
    .from('bookings')
    .select(`
      id,
      check_in,
      status,
      total_price,
      units (unit_number),
      customers (full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  const activeCheckedInBase = supabase
    .from('bookings')
    .select('id, unit_id')
    .eq('status', 'checked_in')
    .lt('check_in', nextDayStr)
    .gt('check_out', todayStr);
  const pendingArrivalsBase = supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'confirmed')
    .eq('check_in', todayStr);
  const delayedBase = supabase
    .from('bookings')
    .select('id, hotel_id, customer_id, customers(full_name), unit_id, units(unit_number, hotel_id)')
    .eq('status', 'confirmed')
    .lt('check_in', todayStr);
  const checkoutBase = supabase
    .from('bookings')
    .select('id, hotel_id, customer_id, customers(full_name), unit_id, units(unit_number, hotel_id)')
    .eq('status', 'checked_in')
    .eq('check_out', todayStr);
  const notifBase = supabase
    .from('system_events')
    .select('id, message, created_at, booking_id')
    .not('booking_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(4);
  // Use the same booking-only feed for both snapshot and fallback paths.
  // Filtering must happen before limiting, rather than filtering snapshot events.
  const bookingNotificationsPromise = (async () => {
    try {
      return await (selectedHotelId !== 'all'
        ? notifBase.eq('hotel_id', selectedHotelId)
        : notifBase);
    } catch {
      return { data: [], error: null };
    }
  })();
  const in1 = new Date(`${todayStr}T00:00:00`);
  in1.setDate(in1.getDate() + 1);
  const in3 = new Date(`${todayStr}T00:00:00`);
  in3.setDate(in3.getDate() + 3);
  const expiringStart = in1.toISOString().split('T')[0];
  const expiringEnd = in3.toISOString().split('T')[0];
  const latePaymentsBase = supabase
    .from('invoices')
    .select('id, booking_id, due_date, booking:bookings!inner(hotel_id, unit_id, units(unit_number))')
    .in('status', ['posted'])
    .not('due_date', 'is', null)
    .lt('due_date', todayStr)
    .order('due_date', { ascending: true })
    .limit(12);
  const expiringBase = supabase
    .from('bookings')
    .select('id, unit_id, check_out, hotel_id, units(unit_number)')
    .in('status', ['checked_in', 'confirmed'])
    .gte('check_out', expiringStart)
    .lte('check_out', expiringEnd)
    .order('check_out', { ascending: true })
    .limit(12);

  const applyHotel = <Q extends { eq: (k: string, v: any) => Q }>(q: Q, hid: string) => hid !== 'all' ? q.eq('hotel_id', hid) : q;

  // ==========================================
  // 🚀 [الأسرع] المحاولة الأولى: الـ RPC الكبير الجديد get_dashboard_full_snapshot
  //    يحمل كل البيانات (18 استعلام) في مكالمة واحدة داخل قاعدة البيانات.
  // 🛟 [الأمان] لو فشل لأي سبب (عدم نشر الدالة، خطأ SQL، إلخ) → Fallback تلقائي
  //    لكود الـ 18 استعلام القديم بالكامل.
  // ==========================================
  let rpcMode: 'rpc' | 'fallback' = 'fallback';
  let unitsData: any = null;
  let activeBookings: any = null;
  let arrivalsToday: any = null;
  let departuresToday: any = null;
  let overdueCheckouts: any = null;
  let bookingsData: any = null;
  let activeCheckedInFinal: any = null;
  let pendingArrivalsCount: number | null = null;
  let delayedBookings: any = null;
  let checkoutBookings: any = null;
  let notifications: any = null;
  let hotelRevenueRes: any = { mode: 'err' as const, msg: '' };
  let latePaymentsRaw: any = null;
  let expiringRaw: any = null;
  let typesData: any = [];
  let tempRes: any = [];

  let snapshotErrorCode = 'none';
  measurement.mark('prepare');
  try {
    const rpcSnap = await supabase.rpc('get_dashboard_full_snapshot', {
      p_hotel_id:        selectedHotelId,
      p_today_str:       todayStr,
      p_next_day_str:    nextDayStr,
      p_last_7_start:    last7Start,
      p_start_of_month:  startOfMonthStr,
      p_expiring_start:  expiringStart,
      p_expiring_end:    expiringEnd
    });
    if (rpcSnap.error) {
      snapshotErrorCode = rpcSnap.error.code || 'rpc_error';
      throw new Error('dashboard_snapshot_failed');
    }
    const snap: any = rpcSnap.data || null;
    if (snap && snap.success === true) {
      rpcMode = 'rpc';
      unitsData             = Array.isArray(snap.units)              ? snap.units              : [];
      activeBookings        = Array.isArray(snap.active_bookings)    ? snap.active_bookings    : [];
      arrivalsToday         = Array.isArray(snap.arrivals_today)      ? snap.arrivals_today     : [];
      departuresToday       = Array.isArray(snap.departures_today)  ? snap.departures_today   : [];
      overdueCheckouts      = Array.isArray(snap.overdue_checkouts) ? snap.overdue_checkouts  : [];
      bookingsData         = Array.isArray(snap.recent_bookings)    ? snap.recent_bookings    : [];
      activeCheckedInFinal = Array.isArray(snap.active_checked_in)  ? snap.active_checked_in  : [];
      pendingArrivalsCount  = typeof snap.pending_arrivals_count === 'number' ? snap.pending_arrivals_count : null;
      delayedBookings     = Array.isArray(snap.delayed_bookings)   ? snap.delayed_bookings    : [];
      checkoutBookings    = Array.isArray(snap.checkout_bookings)  ? snap.checkout_bookings   : [];
      // The all-hotels RPC returns cash-flow stats directly, unlike per-hotel data.
      hotelRevenueRes     = snap.hotel_revenue && !snap.hotel_revenue.mode && 'month_revenue' in snap.hotel_revenue
        ? { mode: 'rpc', data: snap.hotel_revenue }
        : snap.hotel_revenue || { mode: 'err' as const, msg: '' };
      latePaymentsRaw     = Array.isArray(snap.late_payments)      ? snap.late_payments       : [];
      expiringRaw         = Array.isArray(snap.expiring_bookings)  ? snap.expiring_bookings   : [];
      typesData           = Array.isArray(snap.unit_types)         ? snap.unit_types          : [];
      tempRes             = Array.isArray(snap.temp_reservations)  ? snap.temp_reservations   : [];
    } else {
      snapshotErrorCode = 'malformed_response';
      throw new Error('rpc_malformed_response');
    }
  } catch {
    if (snapshotErrorCode === 'none') snapshotErrorCode = 'request_failed';
    rpcMode = 'fallback';
  }
  measurement.mark('snapshot_rpc');

  // ==========================================
  // 🛟 FALLBACK آمن للكود القديم (الـ 18 استعلام)
  //    يتم تشغيله فقط إذا: لم يتم نشر الـ RPC بعد / أو RPC تعطل لأي سبب.
  //    (شروطك مطبقة: لا خلل في المنتج نهائياً + لا ننسى أي حقل)
  // ==========================================
  if (rpcMode === 'fallback') {
    const [
      unitsRes,
      activeBookingsRes,
      arrivalsRes,
      departuresRes,
      overdueRes,
      bookingsRes,
      activeCheckedInRes,
      pendingArrivalsRes,
      delayedRes,
      checkoutRes,
      notificationsRes,
      hotelRevRes,
      latePaymentsRes,
      expiringRes
    ] = await Promise.all([
      applyHotel(unitsBase, selectedHotelId),
      applyHotel(activeBookingsBase, selectedHotelId),
      applyHotel(arrivalsBase, selectedHotelId),
      applyHotel(departuresBase, selectedHotelId),
      applyHotel(overdueBase, selectedHotelId),
      applyHotel(recentBase, selectedHotelId),
      applyHotel(activeCheckedInBase, selectedHotelId),
      applyHotel(pendingArrivalsBase, selectedHotelId),
      applyHotel(delayedBase, selectedHotelId),
      applyHotel(checkoutBase, selectedHotelId),
      bookingNotificationsPromise,
      // الإيرادات والرسوم البيانية — تفرّع حسب الفندق
      (async () => {
        try {
          if (selectedHotelId !== 'all') {
            const monthP = supabase
              .from('payments')
              .select('amount,payment_date,status, invoice:invoices!inner(booking:bookings!inner(hotel_id))')
              .eq('status', 'posted')
              .gte('payment_date', startOfMonthStr)
              .lt('payment_date', endOfMonthExclusiveStr)
              .eq('invoice.booking.hotel_id', selectedHotelId);
            const weekP = supabase
              .from('payments')
              .select('amount,payment_date,status, invoice:invoices!inner(booking:bookings!inner(hotel_id))')
              .eq('status', 'posted')
              .gte('payment_date', last7Start)
              .lte('payment_date', todayStr)
              .eq('invoice.booking.hotel_id', selectedHotelId);
            const [m, w] = await Promise.all([monthP, weekP]);
            return { mode: 'per-hotel', monthData: m.data, weekData: w.data } as const;
          }
          const rpcRes = await supabase.rpc('get_cash_flow_stats');
          if (!rpcRes.error && rpcRes.data) {
            return { mode: 'rpc', data: rpcRes.data } as const;
          }
          const rev = await supabase
            .from('revenue_schedules')
            .select('amount, recognition_date')
            .gte('recognition_date', startOfMonthStr)
            .lt('recognition_date', endOfMonthExclusiveStr);
          return { mode: 'fallback', data: rev.data } as const;
        } catch (e: any) {
          return { mode: 'err' as const, msg: String(e?.message || e) };
        }
      })(),
      // ملخص الترحيب — بنفس الدفعة المتوازية لا تُضيف وقتًا
      selectedHotelId !== 'all' ? latePaymentsBase.eq('booking.hotel_id', selectedHotelId) : latePaymentsBase,
      applyHotel(expiringBase, selectedHotelId)
    ]);

    unitsData             = (unitsRes as any).data;
    activeBookings        = (activeBookingsRes as any).data;
    arrivalsToday         = (arrivalsRes as any).data;
    departuresToday       = (departuresRes as any).data;
    overdueCheckouts      = (overdueRes as any).data;
    bookingsData         = (bookingsRes as any).data;
    activeCheckedInFinal = (activeCheckedInRes as any).data;
    pendingArrivalsCount  = (pendingArrivalsRes as any).count;
    delayedBookings     = (delayedRes as any).data;
    checkoutBookings    = (checkoutRes as any).data;
    notifications       = (notificationsRes as any).data;
    hotelRevenueRes     = hotelRevRes;
    latePaymentsRaw     = (latePaymentsRes as any).data;
    expiringRaw         = (expiringRes as any).data;

    // ==========================================
    // BATCH 3 (Fallback فقط): الاستعلامات التابعة لـ unitsData
    // ==========================================
    const typeIdsFb = Array.from(new Set((unitsData || []).map((u: any) => u.unit_type_id).filter(Boolean)));
    const unitIdsFb = (unitsData || []).map((u: any) => u.id);
    const [_typesData, _tempRes] = await Promise.all([
      (async () => {
        if (typeIdsFb.length === 0) return [];
        const { data } = await supabase
          .from('unit_types')
          .select('id, name, annual_price, daily_price')
          .in('id', typeIdsFb);
        return data || [];
      })(),
      (async () => {
        if (unitIdsFb.length === 0) return [];
        const { data } = await supabase
          .from('temporary_reservations')
          .select('unit_id, customer_name, reserve_date, phone')
          .in('unit_id', unitIdsFb)
          .eq('reserve_date', todayStr);
        return data || [];
      })()
    ]);
    typesData = _typesData;
    tempRes   = _tempRes;
  }

  const bookingNotificationsRes = await bookingNotificationsPromise;
  notifications = bookingNotificationsRes.data || [];

  measurement.mark('fallback_queries');
  const typeMap = new Map<string, any>();
  (typesData || []).forEach((t: any) => typeMap.set(t.id, t));

  // ==========================================
  // BATCH 4: تجهيز التذكيرات — استعلام واحد جماعي بدل حلقة N+1
  // ==========================================
  measurement.mark('type_mapping');
  const reminderBookingIds = Array.from(new Set([
    ...((delayedBookings || []).map((b: any) => b.id)),
    ...((checkoutBookings || []).map((b: any) => b.id)),
  ]));
  const existingRemindersMap = new Map<string, Set<string>>();
  if (reminderBookingIds.length > 0) {
    try {
      const { data: existingRem } = await supabase
        .from('system_events')
        .select('event_type, booking_id')
        .in('booking_id', reminderBookingIds)
        .in('event_type', ['check_in_reminder', 'check_out_reminder'])
        .gte('created_at', todayStr);
      (existingRem || []).forEach((r: any) => {
        if (!r?.booking_id) return;
        const s = existingRemindersMap.get(r.booking_id) || new Set();
        s.add(r.event_type);
        existingRemindersMap.set(r.booking_id, s);
      });
    } catch {}
  }

  // تنبيهات تأخر تسجيل الدخول + مواعيد الخروج — إدراج جماعي (Bulk insert)
  const reminderInserts: any[] = [];
  if (delayedBookings && delayedBookings.length > 0) {
    for (const booking of delayedBookings) {
      const hasSet = existingRemindersMap.get(booking.id);
      if (hasSet?.has('check_in_reminder')) continue;
      const customerName = Array.isArray(booking.customers)
        ? booking.customers[0]?.full_name
        : (booking.customers as any)?.full_name || 'غير معروف';
      const msg = `تنبيه: تأخر تسجيل الدخول للحجز رقم ${String(booking.id).slice(0, 8)} للعميل ${customerName}`;
      reminderInserts.push({
        event_type: 'check_in_reminder',
        booking_id: booking.id,
        unit_id: booking.unit_id,
        customer_id: booking.customer_id,
        hotel_id: (booking as any)?.hotel_id || (booking.units as any)?.hotel_id,
        message: msg
      });
    }
  }
  if (checkoutBookings && checkoutBookings.length > 0) {
    for (const booking of checkoutBookings) {
      const hasSet = existingRemindersMap.get(booking.id);
      if (hasSet?.has('check_out_reminder')) continue;
      const customerName = Array.isArray(booking.customers)
        ? booking.customers[0]?.full_name
        : (booking.customers as any)?.full_name || 'غير معروف';
      const msg = `تنبيه: موعد تسجيل الخروج اليوم للحجز رقم ${String(booking.id).slice(0, 8)} للعميل ${customerName}`;
      reminderInserts.push({
        event_type: 'check_out_reminder',
        booking_id: booking.id,
        unit_id: booking.unit_id,
        customer_id: booking.customer_id,
        hotel_id: (booking as any)?.hotel_id || (booking.units as any)?.hotel_id,
        message: msg
      });
    }
  }
  if (reminderInserts.length > 0) {
    (async () => { try { await supabase.from('system_events').insert(reminderInserts); } catch {} })();
  }

  measurement.mark('reminders');
  // ==========================================
  // إعداد الإيرادات والرسوم البيانية
  // ==========================================
  let totalRevenue = 0;
  let chartData: { date: string; amount: number }[] = [];
  if (hotelRevenueRes && hotelRevenueRes.mode === 'per-hotel') {
    // Bound RPC rows too: its monthData query currently has only a lower limit.
    totalRevenue = (hotelRevenueRes.monthData || [])
      .filter((p: any) => {
        const date = String(p.payment_date || '').slice(0, 10);
        return date >= startOfMonthStr && date < endOfMonthExclusiveStr;
      })
      .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    chartData = last7Days.map((date) => ({
      date: new Date(date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
      amount:
        (hotelRevenueRes.weekData || [])
          .filter((p: any) => String(p.payment_date || '') === date)
          .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0,
    }));
  } else if (hotelRevenueRes && hotelRevenueRes.mode === 'rpc') {
    totalRevenue = Number((hotelRevenueRes as any).data?.month_revenue) || 0;
    const raw = (hotelRevenueRes as any).data?.chart_data || [];
    chartData = raw.map((d: any) => ({
      date: new Date(d.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
      amount: Number(d.amount),
    }));
  } else if (hotelRevenueRes && hotelRevenueRes.mode === 'fallback') {
    const revenueData = (hotelRevenueRes as any).data || [];
    totalRevenue = revenueData.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0) || 0;
    chartData = last7Days.map((date) => ({
      date: new Date(date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
      amount:
        revenueData
          ?.filter((r: any) => String(r.recognition_date || '') === date)
          .reduce((sum: number, r: any) => sum + Number(r.amount), 0) || 0,
    }));
  }

  // ==========================================
  // معالجة الوحدات + الإجراءات اليومية
  // ==========================================
  const activeBookingsMap = new Map<string, { id: string; guest: string; phone?: string; status: string }>();
  activeBookings?.forEach((b: any) => {
      if (b.unit_id) {
        const guestName = Array.isArray(b.customers)
          ? b.customers[0]?.full_name
          : (b.customers as any)?.full_name || unknownGuestName;
        const phone = Array.isArray(b.customers)
          ? b.customers[0]?.phone
          : (b.customers as any)?.phone;
        const existing = activeBookingsMap.get(b.unit_id);
        if (!existing || b.status === 'checked_in') {
          activeBookingsMap.set(b.unit_id, { id: b.id, guest: guestName, phone, status: b.status });
        }
      }
  });

  const unitActionMap = new Map<string, { action: 'arrival' | 'departure' | 'overdue', guest: string, phone?: string }>();
  arrivalsToday?.forEach((b: any) => {
      if(b.unit_id) {
        const guestName = Array.isArray(b.customers)
            ? b.customers[0]?.full_name
            : (b.customers as any)?.full_name || unknownGuestName;
        const phone = Array.isArray(b.customers)
            ? b.customers[0]?.phone
            : (b.customers as any)?.phone;
        unitActionMap.set(b.unit_id, { action: 'arrival', guest: guestName, phone });
      }
  });
  departuresToday?.forEach((b: any) => {
      if(b.unit_id) {
        const guestName = Array.isArray(b.customers)
            ? b.customers[0]?.full_name
            : (b.customers as any)?.full_name || unknownGuestName;
        const phone = Array.isArray(b.customers)
            ? b.customers[0]?.phone
            : (b.customers as any)?.phone;
        unitActionMap.set(b.unit_id, { action: 'departure', guest: guestName, phone });
      }
  });
  overdueCheckouts?.forEach((b: any) => {
      if(b.unit_id) {
        const guestName = Array.isArray(b.customers)
            ? b.customers[0]?.full_name
            : (b.customers as any)?.full_name || unknownGuestName;
        const phone = Array.isArray(b.customers)
            ? b.customers[0]?.phone
            : (b.customers as any)?.phone;
        unitActionMap.set(b.unit_id, { action: 'overdue', guest: guestName, phone });
      }
  });

  let units: Unit[] = (unitsData || []).map((u: any) => {
      const actionInfo = unitActionMap.get(u.id);
      const activeBooking = activeBookingsMap.get(u.id);
      const nested = (u.unit_type ?? null) as any;
      const typeName = nested?.name ?? typeMap.get(u.unit_type_id)?.name;
      const typeAnnual = (
        (nested?.annual_price ?? typeMap.get(u.unit_type_id)?.annual_price) ??
        (nested?.price_per_year ?? typeMap.get(u.unit_type_id)?.price_per_year) ??
        (typeof (nested?.daily_price ?? typeMap.get(u.unit_type_id)?.daily_price) === 'number'
          ? Number(nested?.daily_price ?? typeMap.get(u.unit_type_id)?.daily_price) * 30 * 12
          : undefined)
      );
      const annualNum = typeof typeAnnual === 'number' ? Number(typeAnnual) : (typeAnnual ? Number(typeAnnual) : undefined);
      const displayStatus = (u.status === 'available' && (actionInfo?.action === 'arrival' || activeBooking?.status === 'confirmed')) ? 'booked' : u.status;
      return {
        id: u.id,
        unit_number: u.unit_number,
        status: displayStatus,
        unit_type_id: u.unit_type_id || undefined,
        unit_type_name: typeName || undefined,
        annual_price: annualNum,
        booking_id: activeBooking?.id || undefined,
        guest_name: activeBooking?.guest || actionInfo?.guest,
        next_action: actionInfo?.action,
        action_guest_name: actionInfo?.guest || activeBooking?.guest,
        guest_phone: actionInfo?.phone || activeBooking?.phone
      };
  });

  if (tempRes && tempRes.length > 0) {
    const tempMap = new Map<string, any>();
    tempRes.forEach((t: any) => tempMap.set(t.unit_id, t));
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const t = tempMap.get(u.id);
      if (t) {
        units[i] = {
          ...u,
          has_temp_res: true,
          action_guest_name: t.customer_name,
          guest_phone: t.phone
        };
      }
    }
  }

  const bookings: Booking[] = (bookingsData || []).map((b: any) => ({
    id: b.id,
    guest_name: b.customers?.full_name || unknownGuestName,
    unit_number: b.units?.unit_number || '-',
    check_in: b.check_in,
    status: b.status,
    total_price: Number(b.total_price) || 0
  }));

  const totalUnitsCount = units.length;

  const occupiedUnitIds = new Set<string>((activeCheckedInFinal || []).map((b: any) => b.unit_id).filter(Boolean));
  const occupancyRate = totalUnitsCount > 0 ? Math.round((occupiedUnitIds.size / totalUnitsCount) * 100) : 0;
  const activeBookingsCount = (activeCheckedInFinal || []).length;

  const arrivalsCount = arrivalsToday?.length || 0;
  const departuresCount = departuresToday?.length || 0;
  const overdueCount = overdueCheckouts?.length || 0;
  const last3 = chartData.slice(-3).reduce((s, d) => s + (d.amount || 0), 0);
  const prev3 = chartData.slice(-6, -3).reduce((s, d) => s + (d.amount || 0), 0);
  const trendDelta = prev3 > 0 ? ((last3 - prev3) / prev3) * 100 : null;
  const trendDir = trendDelta == null ? 'neutral' : trendDelta > 5 ? 'up' : trendDelta < -5 ? 'down' : 'flat';
  const topRevenueDay = chartData.length > 0 ? chartData.reduce((max, d) => (d.amount > max.amount ? d : max), chartData[0]) : null;
  let dailyTipText = t(
    'استمر في متابعة الأداء وراجع الأيام الأعلى دخلاً لتحسين التسعير.',
    'Keep tracking performance and review top-revenue days to improve pricing.'
  );
  if (occupancyRate >= 85 && arrivalsCount + departuresCount > 0) {
    dailyTipText = t(
      `نسبة الإشغال مرتفعة (${occupancyRate}%). نسّق تنظيف وحدات المغادرة (${departuresCount}) لتسليم سريع، وفكّر برفع سعر الليلة المتبقية.`,
      `High occupancy (${occupancyRate}%). Coordinate cleaning for ${departuresCount} departures and consider increasing tonight’s rate.`
    );
  } else if (occupancyRate <= 40 && trendDir === 'down') {
    const pct = trendDelta ? Math.abs(Math.round(trendDelta)) : 0;
    dailyTipText = t(
      `الإشغال منخفض (${occupancyRate}%) والاتجاه الإيرادي هابط (${pct}%). فعّل عرض منتصف الأسبوع وركّز على الحجوزات اليومية بالدفع المسبق.`,
      `Low occupancy (${occupancyRate}%) and revenue trend is down (${pct}%). Run mid-week offers and focus on prepaid daily bookings.`
    );
  } else if (overdueCount > 0) {
    dailyTipText = t(
      `لديك حالات تأخر في الخروج (${overdueCount}). تواصل فوراً وحدّث حالة الغرف لتجنب التعارضات وتسريع الجاهزية.`,
      `You have overdue check-outs (${overdueCount}). Follow up immediately and update room status to avoid conflicts and speed up readiness.`
    );
  } else if (arrivalsCount > departuresCount) {
    dailyTipText = t(
      `وصولات اليوم (${arrivalsCount}) أعلى من المغادرات (${departuresCount}). جهّز المفاتيح وخط سير التنظيف لاستقبال سلس.`,
      `Today’s arrivals (${arrivalsCount}) exceed departures (${departuresCount}). Prepare keys and cleaning flow for a smooth check-in.`
    );
  } else if (trendDir === 'up') {
    const pct = trendDelta ? Math.abs(Math.round(trendDelta)) : 0;
    dailyTipText = t(
      `الاتجاه الإيرادي إيجابي (+${pct}%). حافظ على التسعير الحالي وادعم المراجعات الجيدة لزيادة التحويل.`,
      `Revenue trend is positive (+${pct}%). Keep current pricing and encourage good reviews to improve conversion.`
    );
  }
  const dailyTipHighlightLabel = topRevenueDay ? t('أعلى يوم إيراد (7 أيام)', 'Top revenue day (7 days)') : t('نسبة الإشغال', 'Occupancy');
  const dailyTipHighlightValue = topRevenueDay 
    ? `${topRevenueDay.date} — ${currencyFormatter.format(topRevenueDay.amount)}`
    : `${occupancyRate}%`;

  measurement.mark('view_processing');
  measurement.finish({
    mode: rpcMode,
    snapshot_error_code: snapshotErrorCode,
    hotel_scope: selectedHotelId === 'all' ? 'all' : 'single',
    units: units.length,
    recent_bookings: bookings.length,
    revenue_mode: String(hotelRevenueRes?.mode || 'unknown'),
  });
  return (
    <div className="space-y-6 sm:space-y-8 bg-[#f8fafc] min-h-screen rounded-xl p-3 sm:p-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] pb-20 sm:pb-6">
      <DashboardOverview
        language={language}
        today={todayStr}
        isReceptionist={isReceptionist}
        isMarketing={isMarketing}
        revenue={currencyFormatter.format(totalRevenue)}
        occupancyRate={occupancyRate}
        activeBookings={activeBookingsCount}
        arrivals={pendingArrivalsCount || 0}
        notifications={notifications || []}
        chartData={chartData}
        dailyTip={dailyTipText}
      />
      {/* Main Content Grid */}
      <div className="space-y-4 sm:space-y-8">
        <RoomStatusWithDate initialUnits={units} language={language} hotelId={selectedHotelId} />
        {!isMarketing && <RecentBookingsTable bookings={bookings} language={language} />}
      </div>
    </div>
  );
}
