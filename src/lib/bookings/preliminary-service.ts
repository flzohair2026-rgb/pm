import type { SupabaseClient } from '@supabase/supabase-js';

export type BookingSource =
  | 'reception'
  | 'platform'
  | 'broker'
  | 'website'
  | 'api'
  | 'walk_in'
  | 'phone'
  | 'quick';

export type BookingType =
  | 'nightly'
  | 'monthly'
  | 'yearly'
  | 'quick'
  | 'normal';

export interface PreliminaryBookingInput {
  unit_id: string;
  check_in: string;
  check_out: string;
  customer_name: string;
  customer_phone?: string;
  national_id?: string;
  email?: string;
  daily_rate?: number;
  deposit_amount?: number;
  deposit_paid?: boolean;
  notes?: string;
  booking_source: BookingSource;
  booking_type?: BookingType;
  external_reference?: string;
}

export interface PreliminaryBookingResult {
  ok: boolean;
  booking_id?: string;
  customer_id?: string;
  status?: string;
  total_price?: number;
  nights?: number;
  error?: string;
  error_code?:
    | 'invalid_input'
    | 'unit_not_found'
    | 'invalid_dates'
    | 'date_conflict'
    | 'customer_create_failed'
    | 'booking_create_failed'
    | 'duplicate_external_ref'
    | 'server_config';
}

const normalizeArabic = (text: string) => {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/إ|أ|آ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
};

export const getBookingStatusForDeposit = (depositAmount: number, depositPaid: boolean) => {
  if (depositAmount > 0 && depositPaid) return 'preliminary';
  return 'preliminary';
};

export const createPreliminaryBooking = async (
  admin: SupabaseClient<any, 'public', any>,
  input: PreliminaryBookingInput,
): Promise<PreliminaryBookingResult> => {
  const startStr = String(input.check_in || '').trim();
  const endStr = String(input.check_out || '').trim();
  const customerName = String(input.customer_name || '').trim();
  const unitId = String(input.unit_id || '').trim();

  if (!unitId || !startStr || !endStr || !customerName) {
    return { ok: false, error_code: 'invalid_input', error: 'الرجاء إدخال الوحدة والتواريخ واسم العميل' };
  }

  const startDate = new Date(`${startStr}T00:00:00`);
  const endDate = new Date(`${endStr}T00:00:00`);

  let nights = 0;
  try {
    const { differenceInCalendarDays } = require('date-fns') as typeof import('date-fns');
    nights = differenceInCalendarDays(endDate, startDate);
  } catch {
    nights = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  if (nights <= 0 || isNaN(nights)) {
    return { ok: false, error_code: 'invalid_dates', error: 'تواريخ الحجز غير صالحة' };
  }

  const { data: unitRow, error: unitErr } = await admin
    .from('units')
    .select(
      'id, unit_number, status, hotel_id, unit_type_id',
    )
    .eq('id', unitId)
    .maybeSingle();

  if (unitErr || !unitRow) {
    console.warn('[preliminary-service] unit lookup failed:', { unitId, unitErr, unitRow });
    return { ok: false, error_code: 'unit_not_found', error: 'الوحدة المطلوبة غير موجودة في قاعدة البيانات' };
  }

  const unitStatusRaw = String((unitRow as any).status || '').trim().toLowerCase();
  const HARD_BLOCKED_STATUSES = ['deleted', 'archived'];
  if (HARD_BLOCKED_STATUSES.includes(unitStatusRaw)) {
    return {
      ok: false,
      error_code: 'unit_not_found',
      error: 'هذه الوحدة محذوفة أو مؤرشفة. اختر وحدة أخرى.',
    };
  }
  const SOFT_BLOCKED_STATUSES = ['maintenance', 'blocked', 'disabled'];
  const unitNumberLabel = String((unitRow as any).unit_number || '').trim();
  if (SOFT_BLOCKED_STATUSES.includes(unitStatusRaw)) {
    const arReason =
      unitStatusRaw === 'maintenance' ? 'وضع الصيانة النشط' :
      unitStatusRaw === 'blocked' ? 'الحظر اليدوي' :
      'التعطيل';
    console.info(`[preliminary-service] Unit ${unitNumberLabel} has status=${unitStatusRaw} but allowing preliminary booking (dates will be checked by DB EXCLUDE). Reason: ${arReason}`);
  }

  const unitTypeId: string | undefined = (unitRow as any).unit_type_id;
  let unitType: any = {};
  if (unitTypeId) {
    try {
      const { data: utRow, error: utErr } = await admin
        .from('unit_types')
        .select('id, name, daily_price, annual_price, tax_rate')
        .eq('id', unitTypeId)
        .maybeSingle();
      if (!utErr && utRow) {
        unitType = utRow;
      }
    } catch (utErr) {
      console.warn('[preliminary-service] unit_type fetch failed:', utErr);
    }
  }

  const hotelId: string | undefined = (unitRow as any).hotel_id;
  if (!hotelId) {
    return { ok: false, error_code: 'unit_not_found', error: 'الوحدة غير مرتبطة بفندق صالح. قم بربط الوحدة بفندق أولاً.' };
  }

  const dailyPrice = Number(input.daily_rate ?? unitType?.daily_price ?? 0);
  const taxRate = Number(unitType?.tax_rate ?? 0.15);
  const bookingType: any =
    input.booking_type || (nights >= 360 ? 'yearly' : nights >= 30 ? 'monthly' : 'nightly');

  const subtotal = dailyPrice * nights;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const totalPrice = Math.round((subtotal + taxAmount) * 100) / 100;

  const { data: conflicts } = await admin
    .from('bookings')
    .select('id, check_in, check_out, status')
    .eq('unit_id', unitId)
    .in('status', [
      'confirmed',
      'checked_in',
      'pending_deposit',
      'deposit_paid',
      'pending',
      'preliminary',
    ])
    .lt('check_in', endStr)
    .gt('check_out', startStr);

  if ((conflicts || []).length > 0) {
    return {
      ok: false,
      error_code: 'date_conflict',
      error: 'التواريخ تتعارض مع حجز آخر للوحدة',
    };
  }

  const customerPhone = String(input.customer_phone || '').trim();
  const nationalId = String(input.national_id || '').trim();
  const normPhone = normalizeArabic(customerPhone).replace(/\D/g, '');
  const normNationalId = normalizeArabic(nationalId).replace(/\D/g, '');

  let customerId: string | null = null;

  if (normNationalId) {
    const { data: custByNat } = await admin
      .from('customers')
      .select('id')
      .eq('national_id', nationalId)
      .limit(1)
      .maybeSingle();
    if (custByNat) customerId = custByNat.id;
  }

  if (!customerId && normPhone) {
    const { data: custByPhone } = await admin
      .from('customers')
      .select('id')
      .or(`phone.eq.${customerPhone}, phone.eq.${normPhone}`)
      .limit(1)
      .maybeSingle();
    if (custByPhone) customerId = custByPhone.id;
  }

  if (!customerId) {
    const payload: any = {
      full_name: customerName,
      phone: customerPhone || null,
      national_id: nationalId || null,
      email: String(input.email || '').trim() || null,
      customer_type: 'individual',
    };
    const { data: newCust, error: custErr } = await admin
      .from('customers')
      .insert(payload)
      .select('id')
      .single();

    if (custErr || !newCust) {
      return {
        ok: false,
        error_code: 'customer_create_failed',
        error: custErr?.message || 'فشل إنشاء حساب العميل',
      };
    }
    customerId = newCust.id;
  }

  const depositAmount = Number(input.deposit_amount ?? 0);
  const depositPaid = Boolean(input.deposit_paid);
  const preferredStatus: any = 'preliminary';
  const preferredSource: any = input.booking_source;
  const fallbackStatus: any = 'pending';
  const fallbackSource: any = 'reception';

  const buildPayload = (useFallback: boolean, priorErrMsg = '') => {
    const chosenStatus = useFallback ? fallbackStatus : preferredStatus;
    const chosenSource = useFallback ? fallbackSource : preferredSource;
    const fallbackNote = useFallback
      ? `\n\n─── 🔁 Fallback Schema Applied ───\nالسبب: ${priorErrMsg || 'تم استخدام مخطط قديم للقاعدة.'}\nالحالة الأصلية المطلوبة: ${preferredStatus}\nالمصدر الأصلي المطلوب: ${preferredSource}\nملاحظة: تم حفظ البيانات الأصلية بشكل صحيح دون فقدان. قم بتشغيل سكريبت SQL رقم 006 في Supabase لإيقاف هذه الرسالة.`
      : '';
    const rawNotes = String(input.notes || '').trim();
    return {
      hotel_id: hotelId,
      customer_id: customerId,
      unit_id: unitId,
      check_in: startStr,
      check_out: endStr,
      nights,
      booking_type: bookingType,
      status: chosenStatus,
      total_price: totalPrice,
      tax_amount: taxAmount,
      subtotal,
      daily_rate: dailyPrice,
      discount_amount: 0,
      additional_services: [],
      booking_source: chosenSource,
      notes: (rawNotes + fallbackNote) || null,
      external_reference: input.external_reference || null,
    } as any;
  };

  let booking: any = null;
  let bookingErr: any = null;
  let usedFallback = false;
  let fallbackTriggerReason = '';

  const try1Payload = buildPayload(false);
  const { data: b1, error: e1 } = await admin
    .from('bookings')
    .insert(try1Payload)
    .select('id, status, booking_source')
    .single();
  if (!e1 && b1) {
    booking = b1;
  } else {
    const msg = String(e1?.message || '').toLowerCase();
    const isCheckConstraint =
      msg.includes('bookings_booking_source_chk') ||
      msg.includes('bookings_booking_source_check') ||
      msg.includes('bookings_status_check') ||
      msg.includes('bookings_status_chk') ||
      msg.includes('violates check constraint');
    if (isCheckConstraint) {
      usedFallback = true;
      fallbackTriggerReason = String(e1?.message || e1?.details || 'violates check constraint');
      console.warn('[preliminary-service] SCHEMA MISMATCH — switching to FALLBACK values. Reason:', e1?.message);
      const { data: b2, error: e2 } = await admin
        .from('bookings')
        .insert(buildPayload(true, fallbackTriggerReason))
        .select('id, status, booking_source')
        .single();
      if (e2) {
        bookingErr = e2;
      } else {
        booking = b2;
      }
    } else {
      bookingErr = e1;
    }
  }

  if (bookingErr || !booking) {
    const msg = bookingErr?.message || '';
    if (msg.includes('prevent_double_booking') || msg.includes('conflicting key value')) {
      return {
        ok: false,
        error_code: 'date_conflict',
        error: 'تعارض في التواريخ مع حجز آخر للوحدة',
      };
    }
    if (msg.includes('idx_bookings_external_reference_unique') || msg.includes('duplicate') || msg.includes('23505')) {
      return {
        ok: false,
        error_code: 'duplicate_external_ref',
        error: 'هذا الطلب سبق معالجته مسبقاً',
      };
    }
    return {
      ok: false,
      error_code: 'booking_create_failed',
      error: msg || 'فشل إنشاء الحجز',
    };
  }

  try {
    await admin.from('system_events').insert({
      event_type: input.booking_source === 'quick' || input.booking_source === 'reception'
        ? 'quick_booking_created'
        : 'preliminary_booking_created',
      booking_id: booking.id,
      unit_id: unitId,
      customer_id: customerId,
      hotel_id: hotelId,
      message: `حجز أولي (${input.booking_source}): ${customerName} - ${(unitRow as any).unit_number || '-'} - ${startStr} إلى ${endStr}`,
      payload: {
        source: input.booking_source,
        booking_type: bookingType,
        phone: customerPhone || null,
        deposit_amount: depositAmount,
        deposit_paid: depositPaid,
        daily_rate: dailyPrice,
        total_price: totalPrice,
        nights,
        notes: input.notes || null,
      },
    });
  } catch {
    /* ignore event errors */
  }

  return {
    ok: true,
    booking_id: booking.id,
    customer_id: customerId ?? undefined,
    status: booking.status,
    total_price: totalPrice,
    nights,
  };
};
